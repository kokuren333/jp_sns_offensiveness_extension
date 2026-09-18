
export const MODEL_ID = "kokuren/jp-sns-jev7-estimator";
export const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
export const MODEL_URL = `${MODEL_BASE}/model_int8.onnx?download=true`;
export const MODEL_META_URL = `${MODEL_BASE}/model_meta.json`;
export const MODEL_CACHE = "doku-chiwawa-model-v2";
export const MAX_LENGTH = 192;
export const TWEET_LIMIT = 280;
export const AXES = ["insult", "threat", "obscene", "identity_attack", "sexual_explicit", "targetedness", "indirect_hostility"];
export const DISPLAY_AXES = ["insult", "threat", "obscene", "identity_attack", "sexual_explicit", "indirect_hostility"];
export const AXIS_LABELS = { insult: "侮辱", threat: "脅迫", obscene: "下品", identity_attack: "属性攻撃", sexual_explicit: "性的露出", indirect_hostility: "間接的敵意" };
