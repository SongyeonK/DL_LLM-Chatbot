import sys
from oml.utils import EmbeddingModel, EmbeddingModelConfig

# 프론트엔드에서 전달된 모델 이름을 입력 파라미터로 받음
embedding_model = sys.argv[1]
embedding_model_onnx = sys.argv[2]

# 모델 설정 불러오기 및 ONNX 파일 생성
config = EmbeddingModelConfig.from_template("text", max_seq_length=512)
em = EmbeddingModel(model_name=embedding_model, config=config)
em.export2file(embedding_model_onnx, output_dir="./public/uploads")

print(f"Generated ONNX file for {embedding_model}")
