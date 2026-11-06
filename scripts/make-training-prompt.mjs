// 프롬프트 B(학습 표현 만들기)를 현재 레시피 목록으로 채워 data/external/prompt-B-training.md 로 쓴다.
//   node scripts/make-training-prompt.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const recipes = JSON.parse(readFileSync('data/recipes.json', 'utf8')).recipes;
const list = recipes.map((r) => ({ id: r.id, 대표문구: r.ko, 정답설명: r.answers[0].why }));
const body = `당신은 한국어 질문의 다양한 표현을 만드는 작업을 합니다. 결과는 JSON 한 덩어리만 출력하세요(설명·머리말·코드블록 표시 없이).

[배경]
SAPUI5 학습자가 "코드로 하고 싶은 일"을 한국어로 묻는 검색기의 학습 데이터를 만듭니다.
아래 "작업 목록"의 각 항목은 하나의 작업(id)이며, 대표 문구와 정답 설명이 있습니다.

[1. 표현 만들기]
작업마다 같은 뜻의 서로 다른 한국어 질문 표현 30개를 만드세요.
- 의미가 그 작업과 정확히 같아야 하고, 다른 작업과 헷갈리면 안 됩니다.
- 어휘와 문장 구조를 최대한 다르게: 존댓말, 반말, 명사구, 짧은 키워드, 긴 문장(30자 이상), 영어 용어 혼용, 가끔 오탈자.
- 대표 문구를 그대로 복사하지 마세요. 정답 API 의 영어 이름을 질문에 쓰는 것은 작업당 3개 이내.
- 각 표현은 2~100자의 한 문장 또는 구(句)입니다.

[2. 해당 없음 질문 300개]
위 작업 목록의 어느 것에도 해당하지 않는 질문을 만드세요.
(a) UI5 에 관한 질문이지만 위 목록에 없는 기능(예: 지도, 바코드 스캔, 서명, 타일, 카드, 서식 있는 편집기, 툴팁, 마법사 외 컨트롤, 접근성 설정, 아이디 조회 외의 유틸리티 등): 150개
(b) UI5 와 무관한 질문(일반 자바스크립트/CSS/HTML, 다른 프레임워크, 서버·데이터베이스, SAP 비즈니스·ABAP, 일상 질문): 150개

[출력 형식 — JSON 만]
{"paraphrases":{"<작업 id>":["표현1","표현2", "...30개"]},"negatives":["질문1","질문2","...300개"]}
paraphrases 의 키는 반드시 아래 작업 목록의 id 를 그대로 쓰세요(모든 id 를 빠짐없이).

[작업 목록]
${JSON.stringify(list, null, 1)}
`;
mkdirSync('data/external', { recursive: true });
const head = `# 프롬프트 B: 학습 표현과 해당 없음 질문 만들기

**누구에게:** 프롬프트 A 를 시킨 AI 와 **다른 AI**(예: Codex 계열). 이 프롬프트는 레시피 목록을 포함한다(\`node scripts/make-training-prompt.mjs\` 로 최신 레시피에서 다시 만든다).
**결과 저장:** \`data/external/train-<도구이름>.json\` (예: \`train-codex.json\`).
**주의:** 아래 상자 안을 그대로 복사한다. 길어서 응답이 잘리면 id 를 절반씩 나눠 두 번 요청하고, 결과 JSON 을 \`train-<도구>-1.json\`, \`train-<도구>-2.json\` 으로 저장해도 된다.

\`\`\`\`text
`;
const tail = `\`\`\`\`

## 저장 후

\`\`\`bash
node scripts/import-external.mjs train      # 형식 검사
node scripts/train-recipe-model.mjs         # 외부 표현과 해당 없음을 합쳐 다시 학습
\`\`\`
`;
writeFileSync('data/external/prompt-B-training.md', head + body + tail);
console.log(`프롬프트 B 작성: data/external/prompt-B-training.md (작업 ${recipes.length}개, ${(body.length / 1024).toFixed(0)}KB)`);
