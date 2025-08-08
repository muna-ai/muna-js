## 0.0.46
+ Function is now Muna!

## 0.0.45
+ Refactored `Acceleration` enumeration to be string union type.

## 0.0.44
+ Refactored `AccessMode` type to `PredictorAccess`.
+ Removed `INVALID` predictor status.
+ Removed `Predictor.predictions` field.
+ Removed `Predictor.error` field.
+ Upgraded to Function C 0.0.35.

## 0.0.43
+ Refactored `PROVISIONING` predictor status to `COMPILING`.
+ Removed `Parameter.defaultValue` field.
+ Upgraded to Function C 0.0.34.

## 0.0.42
+ Added `fxn.beta.predictions.remote.create` method for creating predictions on remote GPU servers.
+ Upgraded to Function C 0.0.34.

## 0.0.41
+ Fixed `Function` client not detecting `FXN_ACCESS_KEY` environment variable.
+ Fixed `Function` client not detecting `FXN_API_URL` environment variable.
+ Removed `PREDICTION_FIELDS` constant.

## 0.0.40
+ Function now supports Linux, across `x86_64` and `arm64` architectures.

## 0.0.39
+ Updated `Acceleration` type from string constant to integer enumeration.
+ Updated `Value` type to be a union of plain JavaScript types.
+ Removed `fxn.environmentVariables` field.
+ Removed `fxn.storage` field.
+ Removed `fxn.users.update` method.
+ Removed `fxn.predictors.list` method.
+ Removed `fxn.predictors.search` method.
+ Removed `fxn.predictors.create` method.
+ Removed `fxn.predictors.delete` method.
+ Removed `fxn.predictors.archive` method.
+ Removed `fxn.predictions.toObject` method.
+ Removed `fxn.predictions.toValue` method.
+ Removed `Predictor.type` field.
+ Removed `Predictor.acceleration` field.
+ Removed `Prediction.type` field.
+ Removed `isFunctionValue` type predicate function.
+ Removed `EnvironmentVariable` type.
+ Removed `PredictorType` type.
+ Removed `Profile` type.
+ Removed `UploadType` type.
+ Removed `USER_FIELDS` constant.
+ Removed `PROFILE_FIELDS` constant.
+ Removed `PREDICTOR_FIELDS` constant.
+ Upgraded to Function C 0.0.27.

## 0.0.38
+ Fixed Webpack bundler errors caused by Function.

## 0.0.37
+ Fixed package install error due to missing dependencies.

## 0.0.36
+ Fixed package install error due to required script excluded from packaging process.

## 0.0.35
+ Added edge prediction support on Node.js when running on macOS and Windows. Linux coming soon!
+ Improved edge predictor memory consumption when predictors input and output tensors.
+ Fixed `fxn.predictions.create` method with large input images resulting in `413 Payload Too Large` error.
+ Fixed `Prediction.configuration` being populated with invalid token when edge prediction is created with `null` configuration identifier.
+ Refactored `Acceleration` type from enumeration to string literal.
+ Refactored `AccessMode` type from enumeration to string literal.
+ Refactored `PredictorStatus` type from enumeration to string literal.
+ Refactored `PredictorType` type from enumeration to string literal.
+ Refactored `UploadType` type from enumeration to string literal.
+ Updated `Image.data` field type to `Uint8ClampedArray`.
+ Upgraded to Function C 0.0.26.

## 0.0.34
+ Added `Image.channels` field for inspecting image channel count.
+ Fixed edge prediction output `Image` having incorrect `width` and `height`.
+ Upgraded to Function C 0.0.20.

## 0.0.33
+ Fixed edge prediction errors caused by request backpressure while the predictor is being loaded.
+ Upgraded to Function C 0.0.19.

## 0.0.32
+ Fixed `isFunctionValue` type guard function returning `false` for `null` Function values.

## 0.0.31
+ Upgraded to Function C 0.0.18.

## 0.0.30
+ Added support for making edge predictions on `ImageData` input values.
+ Fixed `fxn.predictors.retrieve` not populating signature output parameter `schema`.

## 0.0.29
+ Fixed error when making edge predictions with image input values.

## 0.0.28
+ Fixed prediction proxying errors when large prediction input values are uploaded.
+ Refactored `toFunctionValue` function to `fxn.predictions.toValue` method.
+ Refactored `toPlainValue` function to `fxn.predictions.toObject` method.

## 0.0.27
+ Minor updates.

## 0.0.26
+ Added `CreatePredictionInput.client` field for overriding client identifier when making predictions.
+ Added `CreatePredictionInput.configuration` field for overriding configuration identifier when making predictions.
+ Added `PredictionResource.name` field for handling resources with required file names.
+ Fixed certain edge predictors failing to be loaded on Google Chrome due to size restrictions.

## 0.0.25
+ Removed `AccessMode.Protected` access mode. Use `AccessMode.Public` or `AccessMode.Private` instead.
+ Removed `PredictionResource.id` field as it is no longer used.

## 0.0.24
+ Added `PredictionResource.type` field for inspecting the type of a prediction resource.

## 0.0.23
+ Added experimental support for running on-device predictions in the browser with WebAssembly!
+ Added `fxn.predictions.delete` method to delete a loaded edge predictor from memory.
+ Added `bigint` support for prediction inputs and outputs.
+ Added `Tensor` type for working with tensors.
+ Fixed `fxn.predictions.create` wrongly returning scalar result for single-element vector output.
+ Fixed `fxn.predictors.list` returning `null` when listing organization predictors.
+ Removed `CloudPrediction` interface. Use `Prediction` interface instead.
+ Removed `EdgePrediction` interface. Use `Prediction` interface instead.
+ Removed `ToFunctionValueInput.shape` input field. Use `Tensor` type instead.

## 0.0.22
+ Added `AccessMode.Protected` enumeration member for working with protected predictors.

## 0.0.21
+ Added `Function.predictions.stream` method to create a streaming prediction.

## 0.0.20
+ Added `Parameter.schema` field for inspecting the JSON schema for `dict` and `list` parameters.

## 0.0.19
+ Added support for making predictions in Vercel Serverless Functions using their edge Runtime.

## 0.0.18
+ Refactored `Predictor.readme` field to `card`.

## 0.0.17
+ Added `Dtype.null` constant for working with `null` prediction values.
+ Added support for `ArrayBuffer` instances as prediction inputs.
+ Fixed `isFunctionValue` utility method throwing error on `null` input.

## 0.0.16
+ Added support for using `TypedArray` instances as prediction inputs and outputs.
+ Added `isFunctionValue` utility method for checking whether a `value` is a Function value.
+ Refactored `Feature` type to `Value` to improve clarity.
+ Refactored `FeatureValue` type to `PlainValue` to improve clarity.
+ Refactored `UploadType.Feature` enumeration member to `UploadType.Value`.
+ Refactored `featureFromValue` function to `toFunctionValue`.
+ Refactored `featureToValue` function to `toPlainValue`.

## 0.0.15
+ Fixed `fxn.environmentVariables.list` method throwing error.

## 0.0.14
+ Added UMD script for using Function without a bundler.

## 0.0.13
+ Minor stability updates.

## 0.0.12
+ Minor stability updates.

## 0.0.11
+ Added support for Vercel Edge runtime.
+ Fixed `Parameter.enumeration` field type to be `EnumerationMember[]` instead of `EnumerationMember`.

## 0.0.10
+ Added `featureFromValue` function for creating a prediction feature from a JavaScript value.
+ Added `featureToValue` function for creating a JavaScript value from a prediction feature.

## 0.0.9
+ Fixed `crypto` exception when calling `Function.predictions.create` in a web browser.

## 0.0.8
+ Removed `CreatePredictionInput.features` input field. Use `CreatePredictionInput.inputs` input field instead.
+ Removed `PREDICTION_FIELDS_RAW` constant. Use `PREDICTION_FIELDS` constant instead.
+ Removed `ParameterInput` type.

## 0.0.7
+ Added `EnumerationMember` class for working with parameters that are enumeration values.
+ Added `Parameter.enumeration` field for inspecting parameters which hold enumeration values.
+ Added `Parameter.defaultValue` field for inspecting the default value of a predictor parameter.
+ Renamed `Dtype.3d` data type to `model`.
+ Removed `Parameter.stringDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.intDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.floatDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.boolDefault` field. Use `Parameter.defaultValue` field instead.

## 0.0.6
+ Added `Predictor.predictions` field for inspecting the number of predictions made with a predictor.
+ Added `Predictor.readme` field for inspecting the predictor README from the predictor notebook.
+ Fixed `Predictor.error` field not being populated for `INVALID` predictors.

## 0.0.5
+ Fixed `Function.predictors.list` function raising errors.
+ Fixed `Function.storage.createUploadUrl` function raising errors.

## 0.0.4
+ Added `EnvironmentVariable` type for managing predictor environment variables.
+ Added `Function.environmentVariables` service for managing global predictor environment variables.
+ Added `CreatePredictorInput.overwrite` input field for overwriting an existing predictor with the same tag.

## 0.0.3
+ Removed `Predictor.topics` field.

## 0.0.2
+ Populating API.

## 0.0.1
+ First pre-release.