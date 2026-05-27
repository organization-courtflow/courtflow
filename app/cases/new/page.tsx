import { PageTitle } from "@/components/PageTitle";
import { createCaseAction } from "@/app/cases/actions";

export default function NewCasePage() {
  return (
    <>
      <PageTitle
        eyebrow="Case Intake"
        title="새 사건 생성"
        description="처음에는 완벽한 문서가 필요하지 않습니다. 사건 제목, 유형, 입장, 간단한 설명만으로 상담 준비 흐름을 시작합니다."
      />

      <section className="content-narrow">
        <form className="card form" action={createCaseAction}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Draft</p>
              <h2>기본 정보</h2>
            </div>
            <span className="tag">draft</span>
          </div>
          <div className="field">
            <label htmlFor="title">사건 제목</label>
            <input id="title" name="title" placeholder="예: 대여금 반환 상담 준비" />
          </div>
          <div className="field">
            <label htmlFor="type">사건 유형</label>
            <select id="type" name="type" defaultValue="civil">
              <option value="civil">민사</option>
              <option value="criminal">형사</option>
              <option value="family">가정</option>
              <option value="juvenile">소년</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="position">사용자 입장</label>
            <input id="position" name="position" placeholder="예: 돈을 빌려준 사람, 피고인, 피해자" />
          </div>
          <div className="field">
            <label htmlFor="description">간단한 사건 설명</label>
            <textarea
              id="description"
              name="description"
              placeholder="언제, 어디서, 누가, 무엇을 했는지 편하게 적어주세요."
            />
          </div>
          <button className="button" type="submit">
            사건 생성
          </button>
        </form>
      </section>
    </>
  );
}
