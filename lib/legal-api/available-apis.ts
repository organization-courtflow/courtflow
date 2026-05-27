export type LegalApiAccessFormat = {
  listJson: boolean;
  bodyJson: boolean;
};

export type AvailableLegalApi = {
  label: string;
  category:
    | "core"
    | "committee"
    | "ministry_interpretation"
    | "agency_interpretation"
    | "knowledge_base";
  format: LegalApiAccessFormat;
};

export const defaultJsonAccess = {
  listJson: true,
  bodyJson: true
} satisfies LegalApiAccessFormat;

export const availableLegalApis = [
  { label: "대한민국 현행법령", category: "core", format: defaultJsonAccess },
  { label: "현행 행정규칙", category: "core", format: defaultJsonAccess },
  { label: "현행 학칙공단", category: "core", format: defaultJsonAccess },
  { label: "현행 자치법규", category: "core", format: defaultJsonAccess },
  { label: "판례", category: "core", format: defaultJsonAccess },
  { label: "헌재결정례", category: "core", format: defaultJsonAccess },
  { label: "법령해석례", category: "core", format: defaultJsonAccess },
  { label: "행정심판례", category: "core", format: defaultJsonAccess },
  { label: "조약", category: "core", format: defaultJsonAccess },
  { label: "법령용어", category: "core", format: defaultJsonAccess },
  { label: "법령 별표·서식", category: "core", format: defaultJsonAccess },
  { label: "행정규칙 별표·서식", category: "core", format: defaultJsonAccess },
  { label: "자치법규 별표·서식", category: "core", format: defaultJsonAccess },
  { label: "영문법령", category: "core", format: defaultJsonAccess },
  { label: "개인정보보호위원회", category: "committee", format: defaultJsonAccess },
  { label: "고용보험심사위원회", category: "committee", format: defaultJsonAccess },
  { label: "공정거래위원회", category: "committee", format: defaultJsonAccess },
  { label: "국민권익위원회", category: "committee", format: defaultJsonAccess },
  { label: "노동위원회", category: "committee", format: defaultJsonAccess },
  { label: "금융위원회", category: "committee", format: defaultJsonAccess },
  { label: "방송미디어통신위원회", category: "committee", format: defaultJsonAccess },
  { label: "산업재해보상보험재심사위원회", category: "committee", format: defaultJsonAccess },
  { label: "중앙토지수용위원회", category: "committee", format: defaultJsonAccess },
  { label: "중앙환경분쟁조정위원회", category: "committee", format: defaultJsonAccess },
  { label: "증권선물위원회", category: "committee", format: defaultJsonAccess },
  { label: "국토교통부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "기후에너지환경부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "행정안전부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "국세청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "관세청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "조세심판원 특별행정심판례", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "해양안전심판원 특별행정심판례", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "해양수산부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "재정경제부 법령해석", category: "ministry_interpretation", format: { listJson: false, bodyJson: false } },
  { label: "국가인권위원회", category: "committee", format: defaultJsonAccess },
  { label: "교육부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "과학기술정보통신부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "국가보훈부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "국방부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "농림축산식품부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "문화체육관광부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "법무부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "보건복지부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "산업통상부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "성평등가족부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "외교부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "중소벤처기업부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "통일부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "법제처 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "식품의약품안전처 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "인사혁신처 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "기상청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "국가유산청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "고용노동부 법령해석", category: "ministry_interpretation", format: defaultJsonAccess },
  { label: "농촌진흥청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "경찰청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "방위사업청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "병무청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "산림청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "소방청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "재외동포청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "조달청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "질병관리청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "국가데이터처 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "지식재산처 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "해양경찰청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "행정중심복합도시건설청 법령해석", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "국민권익위원회 특별행정심판재결례", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "인사혁신처 소청심사위원회 특별행정심판재결례", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "감사원 사전컨설팅 의견서", category: "agency_interpretation", format: defaultJsonAccess },
  { label: "법령용어", category: "knowledge_base", format: defaultJsonAccess },
  { label: "일상용어", category: "knowledge_base", format: defaultJsonAccess },
  { label: "관련법령", category: "knowledge_base", format: defaultJsonAccess },
  { label: "지능형 법령검색 시스템 검색 API", category: "knowledge_base", format: defaultJsonAccess },
  { label: "지능형 법령검색 시스템 연관법령 API", category: "knowledge_base", format: defaultJsonAccess },
  { label: "법령용어-일상용어 연계", category: "knowledge_base", format: defaultJsonAccess },
  { label: "일상용어-법령용어 연계", category: "knowledge_base", format: defaultJsonAccess },
  { label: "법령용어-조문", category: "knowledge_base", format: defaultJsonAccess },
  { label: "조문-법령용어", category: "knowledge_base", format: defaultJsonAccess }
] as const satisfies readonly AvailableLegalApi[];

export const availableLegalApiPrompt = `
CourtFlow AI can request approved National Law Information Open API data in JSON format.
Use only API responses or records already saved from these approved sources as legal citations.
Approved source groups include: current Korean laws, administrative rules, local ordinances, precedents, Constitutional Court decisions, legal interpretation cases, administrative appeal cases, treaties, legal terms, law appendices/forms, English laws, committee decisions, ministry/agency legal interpretations, special administrative tribunal decisions, audit pre-consulting opinions, and intelligent legal knowledge-base APIs.
For selected APIs, prefer list JSON and body JSON. Do not assume HTML or XML access unless the backend explicitly provides it.
If no official source is available for a claim, say that the source is not yet confirmed instead of inventing a statute, article, precedent, case number, court name, or decision date.
`.trim();
