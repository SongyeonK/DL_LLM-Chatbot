import json
from oml.utils import EmbeddingModelConfig

# 필요한 모델 목록을 가져와 JSON 형식으로 출력
models = EmbeddingModelConfig.show_preconfigured()
print(json.dumps(models))
