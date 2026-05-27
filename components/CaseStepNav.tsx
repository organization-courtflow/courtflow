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
  { id: "intake", href: "intake", label: "사건 정리", icon: MessageSquareText },
  { id: "evidence", href: "evidence", label: "증거 정리", icon: FolderOpen },
  { id: "research", href: "research", label: "법령 검색", icon: FileSearch },
  { id: "strategy", href: "strategy", label: "주장 준비", icon: ClipboardList },
  { id: "simulate", href: "simulate", label: "시뮬레이션", icon: Scale },
  { id: "judgment", href: "judgment", label: "판사 판단", icon: Gavel },
  { id: "report", href: "report", label: "상담 리포트", icon: ScrollText }
];

type CaseStepNavProps = {
  caseId: string;
  current: string;
};

export function CaseStepNav({ caseId, current }: CaseStepNavProps) {
  return (
    <nav className="step-nav" aria-label="사건 단계">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === current;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "active" : undefined}
            href={`/cases/${caseId}/${step.href}`}
            key={step.id}
          >
            <span>{index + 1}</span>
            <Icon size={16} aria-hidden="true" />
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
