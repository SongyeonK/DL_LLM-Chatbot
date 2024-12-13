import sys
import json
from konlpy.tag import Kkma
from transformers import BertTokenizer, BertForTokenClassification, pipeline

def split_text_by_kkma(text):
  kkma = Kkma()
  sentences = kkma.sentences(text)
  return sentences

def split_text_by_bert_ner(text):
  tokenizer = BertTokenizer.from_pretrained('monologg/kobert')
  model = BertForTokenClassification.from_pretrained('monologg/kobert')
  nlp = pipeline('ner', model=model, tokenizer=tokenizer)

  sentences = text.split('. ')
  chunks = []

  for sentence in sentences:
    if sentence:
      ner_results = nlp(sentence)
      chunk = ''
      for word in ner_results:
        chunk += word['word'] + ' '
        if word['entity'].startswith('B-'):
          chunks.append(chunk.strip())
          chunk = ''
      if chunk:
        chunks.append(chunk.strip())

  return chunks

def split_text_by_spacy(text):
  import spacy
  nlp = spacy.load('en_core_web_sm')
  doc = nlp(text)
  chunks = [sent.text.strip() for sent in doc.sents]
  return chunks

if __name__ == '__main__':
  method = sys.argv[1]
  text = sys.argv[2]

  if method == 'kkma':
    chunks = split_text_by_kkma(text)
  elif method == 'bert':
    chunks = split_text_by_bert_ner(text)
  elif method == 'spacy':
    chunks = split_text_by_spacy(text)
  else:
    raise ValueError(f"Unsupported method: {method}")

  print(json.dumps(chunks))
