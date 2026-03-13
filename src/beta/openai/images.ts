/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { encode } from "base64-arraybuffer"
import { getFxnc } from "../../c"
import type { CreatePredictionInput, PredictorService, PredictionService } from "../../services"
import type { Acceleration, Prediction, Image, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import type { ImageResponse } from "./types"

export type ImageSize =
    | "auto"
    | "1024x1024"
    | "1536x1024"
    | "1024x1536"
    | "256x256"
    | "512x512"
    | "1792x1024"
    | "1024x1792";

export interface ImageCreateParams {
    /**
     * Text description of the desired image.
     */
    prompt: string;
    /**
     * Image generation model tag.
     */
    model: string;
    /**
     * Set transparency for the background of the generated image(s).
     */
    background?: "auto" | "transparent" | "opaque";
    /**
     * Number of images to generate.
     */
    n?: number;
    /**
     * The format in which the generated images are returned.
     */
    output_format?: "png" | "jpeg" | "webp" | "raw";
    /**
     * The compression level for the generated images in range `[0, 100]`.
     */
    output_compression?: number;
    /**
     * The size of the generated images.
     */
    size?: ImageSize;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

type ImageDelegate = (params: Omit<ImageCreateParams, "model">) => Promise<ImageResponse>;

export class ImageService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;
    private readonly cache: Map<string, ImageDelegate>;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
        this.cache = new Map<string, ImageDelegate>();
    }

    /**
     * Create an image given a prompt.
     */
    public async create({
        model: tag,
        prompt,
        background,
        n,
        output_format = "png",
        output_compression,
        size,
        acceleration = "local_auto"
    }: ImageCreateParams): Promise<ImageResponse> {
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        const delegate = this.cache.get(tag);
        const result = await delegate({
            prompt,
            background,
            n,
            output_format,
            output_compression,
            size,
            acceleration
        });
        return result;
    }

    private async createDelegate(tag: string): Promise<ImageDelegate> {
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI image API because ` +
                `the predictor could not be found. Check that your access key ` +
                `is valid and that you have access to the predictor.`
            );
        const signature = predictor.signature;
        const requiredInputs = signature.inputs.filter(param => !param.optional);
        if (requiredInputs.length !== 1)
            throw new Error(
                `${tag} cannot be used with OpenAI image API because ` +
                `it has more than one required input parameter.`
            );
        const promptParam = requiredInputs.find(param => param.dtype === "string");
        if (!promptParam)
            throw new Error(
                `${tag} cannot be used with OpenAI image API because ` +
                `it does not have a valid text prompt input parameter.`
            );
        const widthParam = signature.inputs.find(param =>
            NUMERIC_DTYPES.includes(param.dtype) &&
            param.denotation === "openai.images.width"
        );
        const heightParam = signature.inputs.find(param =>
            NUMERIC_DTYPES.includes(param.dtype) &&
            param.denotation === "openai.images.height"
        );
        const countParam = signature.inputs.find(param =>
            NUMERIC_DTYPES.includes(param.dtype) &&
            param.denotation === "openai.images.count"
        );
        const imageParamIdx = signature.outputs.findIndex(param =>
            param.dtype === "image_list"
        );
        if (imageParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI image API because ` +
                `it has no image outputs.`
            );
        const delegate = async ({
            prompt,
            n,
            output_format,
            output_compression,
            size,
            acceleration
        }: Omit<ImageCreateParams, "model">): Promise<ImageResponse> => {
            const [requestedWidth, requestedHeight] = parseImageSize(size);
            const predictionInputs: Record<string, Value> = {
                [promptParam.name]: prompt
            };
            if (n != null && countParam)
                predictionInputs[countParam.name] = n;
            if (requestedWidth != null && widthParam)
                predictionInputs[widthParam.name] = requestedWidth;
            if (requestedHeight != null && heightParam)
                predictionInputs[heightParam.name] = requestedHeight;
            const prediction = await this.createPrediction({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            if (prediction.error)
                throw new Error(prediction.error);
            const images = prediction.results[imageParamIdx] as Image[];
            if (!Array.isArray(images))
                throw new Error(`${tag} returned object of type ${typeof images} instead of an image list`);
            const data = await Promise.all(images.map(image => createImageData(
                image,
                output_format,
                output_compression
            )));
            const result: ImageResponse = {
                data,
                background: "opaque",
                created: Math.floor(Date.now() / 1000)
            };
            return result;
        };
        return delegate;
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        if ((input.acceleration as string)?.startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        else
            return this.predictions.create(input as CreatePredictionInput);
    }
}

async function createImageData(
    image: Image,
    outputFormat: "png" | "jpeg" | "webp" | "raw",
    outputCompression?: number
): Promise<ImageResponse.ImageData> {
    if (outputFormat === "raw")
        return { image };
    if (outputFormat === "webp")
        throw new Error("webp output format is not yet supported");
    const { FXNValue } = await getFxnc();
    let mime = `image/${outputFormat}`;
    if (outputCompression != null)
        mime += `;quality=${outputCompression}`;
    const imageValue = FXNValue.createImage(image, 0);
    const buffer = imageValue.serialize(mime);
    imageValue.dispose();
    return { b64_json: encode(buffer) };
}

function parseImageSize(size?: ImageSize): [number | null, number | null] {
    if (!size || size === "auto")
        return [null, null];
    const [w, h] = size.split("x", 2);
    return [parseInt(w), parseInt(h)];
}

const NUMERIC_DTYPES = [
    "int8", "int16", "int32", "int64",
    "uint8", "uint16", "uint32", "uint64"
];