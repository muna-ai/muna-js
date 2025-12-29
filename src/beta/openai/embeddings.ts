/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { encode } from "base64-arraybuffer"
import type { CreatePredictionInput, PredictorService, PredictionService } from "../../services"
import { isTensor } from "../../types"
import type { Acceleration, Prediction, Tensor, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import type { CreateEmbeddingResponse, Embedding } from "./types"

export interface EmbeddingCreateParams {
    /**
     * Input text to embed, encoded as a string or array of strings.
     */
    input: string | string[];
    /**
     * Embedding predictor tag.
     */
    model: string;
    /**
     * The number of dimensions the resulting output embeddings should have.
     * Only supported in Matryoshka embedding models.
     */
    dimensions?: number;
    /**
     * The format to return the embeddings in.
     */
    encoding_format?: "float" | "base64";
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

type EmbeddingDelegate = (params: Omit<EmbeddingCreateParams, "model">) => Promise<CreateEmbeddingResponse>;

export class EmbeddingService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;
    private readonly cache: Map<string, EmbeddingDelegate>;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
        this.cache = new Map<string, EmbeddingDelegate>();
    }

    public async create({
        model: tag,
        input,
        encoding_format = "float",
        acceleration = "remote_auto"
    }: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
        // Ensure we have a delegate
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        // Make prediction
        const delegate = this.cache.get(tag);
        const response = await delegate({
            input: typeof input === "string" ? [input] : input,
            encoding_format,
            acceleration
        });
        // Return
        return response;
    }

    private async createDelegate(tag: string): Promise<EmbeddingDelegate> {
        // Retrieve predictor
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI embedding API because 
                the predictor could not be found. Check that your access key 
                is valid and that you have access to the predictor.`
            );
        // Check that there is only one required input paramete
        const signature = predictor.signature;
        if (signature.inputs.filter(param => !param.optional).length !== 1)
            throw new Error(
                `${tag} cannot be used with OpenAI embedding API because 
                it has more than one required input parameters.`
            );
        // Check that the input parameter is `list[str]`
        const inputParam = signature.inputs.find(param => param.type === "list");
        if (!inputParam)
            throw new Error(
                `${tag} cannot be used with OpenAI embedding API because 
                it does not have the required text embedding input parameter.`
            );
        // Get the Matryoshka dim parameter (optional)
        const matryoshkaParam = signature.inputs.find(param => 
            param.type.includes("int") && 
            param.denotation === "openai.embeddings.dims"
        );
        // Get the index of the embedding output parameter
        const embeddingParamIdx = signature.outputs.findIndex(param =>
            param.type === "float32" &&
            param.denotation === "embedding"
        );
        if (embeddingParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI embedding API because 
                it has no outputs with an \`embedding\` denotation.`
            );
        // Get the index of the usage output (optional)
        const usageParamIdx = -1; // INCOMPLETE
        // Define the delegate
        const delegate = async ({
            input,
            dimensions,
            encoding_format,
            acceleration,
        }: Omit<EmbeddingCreateParams, "model">): Promise<CreateEmbeddingResponse> => {
            // Build prediction input map
            const predictionInputs: Record<string, Value> = { [inputParam.name]: input };
            if (dimensions != null && matryoshkaParam)
                predictionInputs[matryoshkaParam.name] = dimensions;
            // Create prediction
            const prediction = await this.createPrediction({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            // Check for error
            if (prediction.error)
                throw new Error(prediction.error);
            // Check returned embedding
            const embeddingMatrix = prediction.results[embeddingParamIdx];
            if (!isTensor(embeddingMatrix))
                throw new Error(`${tag} returned object of type ${typeof embeddingMatrix} instead of an embedding matrix`);
            if (!(embeddingMatrix.data instanceof Float32Array))
                throw new Error(
                    `${tag} returned embedding matrix with invalid data type: 
                    ${embeddingMatrix.constructor.name.replace("Array", "").toLowerCase()}`
                );
            if (embeddingMatrix.shape.length !== 2)
                throw new Error(`${tag} returned embedding matrix with invalid shape: ${embeddingMatrix.shape}`);
            // Create embedding response
            const usage = usageParamIdx >= 0 ?
                prediction.results[usageParamIdx] as CreateEmbeddingResponse.Usage :
                { prompt_tokens: 0, total_tokens: 0 } satisfies CreateEmbeddingResponse.Usage;
            const embeddings = Array
                .from({ length: embeddingMatrix.shape[0] }, (_, i) => i)
                .map(idx => this.parseEmbedding(embeddingMatrix, idx, encoding_format));
            const response = {
                object: "list",
                model: tag,
                data: embeddings,
                usage
            } satisfies CreateEmbeddingResponse;
            // Return
            return response;
        };
        // Return
        return delegate;
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        if ((input.acceleration as string).startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        else
            return this.predictions.create(input as CreatePredictionInput);
    }

    private parseEmbedding(matrix: Tensor, index: number, encoding: "float" | "base64"): Embedding {
        const [_, length] = matrix.shape;
        const data = matrix.data as Float32Array;
        const startIdx = index * length;
        const endIdx = (index + 1) * length;
        const embedding = encoding === "base64" ?
            encode(data.slice(startIdx, endIdx).buffer) :
            Array.from(data.subarray(startIdx, endIdx));
        return { object: "embedding", embedding, index };
    }
}