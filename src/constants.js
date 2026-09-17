
export const MODEL_ID = "kokuren/jp-sns-offensiveness-estimator";
export const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
export const MODEL_URL = `${MODEL_BASE}/onnx/model_int8.onnx?download=true`;
export const METRICS_URL = `${MODEL_BASE}/metrics.json`;
export const MODEL_CACHE = "jp-offensiveness-model-v1";
export const MAX_LENGTH = 128;
export const TWEET_LIMIT = 280;
