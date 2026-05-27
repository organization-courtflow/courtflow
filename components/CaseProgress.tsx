import Link from "next/link";
import {
  ClipboardList,
  FileSearch,
  FolderOpen,
  Gavel,
  MessageSquareText,
  Scale,
  ScrollText
} from "lucide-react";

const steps = [
  {
    href: "/cases/demo/intake",
    icon: MessageSquareText,
    title: "사건 정리",
    description: "자유 입력을 시간순 경위, 인물, 쟁점으로 구조화합니다."
  },
  {
    href: "/cases/demo/evidence",
    icon: FolderOpen,
    title: "증거 정리",
    description: "증거별 입증 사실, 강점, 약점, 보완 자료를 정리합니다."
  },
  {
    href: "/cases/demo/research",
    icon: FileSearch,
    title: "법령/판례 검색",
    description: "공식 API와 저장 자료만 근거로 연결합니다."
  },
  {
    href: "/cases/demo/strategy",
    icon: ClipboardList,
    title: "주장 준비",
    description: "사용자 측 주장과 상대방 예상 반박을 나란히 구성합니다."
  },
  {
    href: "/cases/demo/simulate",
    icon: Scale,
    title: "1심 시뮬레이션",
    description: "시작 후에는 관찰 모드로 진행 로그를 확인합니다."
  },
  {
    href: "/cases/demo/report",
    icon: ScrollText,
    title: "상담 리포트",
    description: "상담 때 가져갈 자료와 질문 목록까지 정리합니다."
  }
];

export function CaseProgress() {
  return (
    <div className="workflow">
      {steps.map((step) => {
        const Icon = step.icon;

        return (
          <Link key={step.href} href={step.href}>
            <Icon size={22} aria-hidden="true" />
            <span>
              <strong>{step.title}</strong>
              <br />
              <small className="muted">{step.description}</small>
            </span>
          </Link>
        );
      })}
      <Link href="/cases/demo/judgment">
        <Gavel size={22} aria-hidden="true" />
        <span>
          <strong>판사 판단</strong>
          <br />
          <small className="muted">인정 사실, 쟁점별 판단, 불확실한 부분을 표시합니다.</small>
        </span>
      </Link>
    </div>
  );
}
