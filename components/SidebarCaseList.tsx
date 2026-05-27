"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCaseAction } from "@/app/cases/actions";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import type { SidebarCase } from "@/lib/cases/sidebar";

type SidebarCaseListProps = {
  cases: SidebarCase[];
};

export function SidebarCaseList({ cases }: SidebarCaseListProps) {
  const pathname = usePathname();

  if (cases.length === 0) {
    return <p className="sidebar-empty">아직 생성된 사건이 없습니다.</p>;
  }

  return (
    <nav className="sidebar-case-list">
      {cases.map((item) => {
        const isActive = pathname.includes(`/cases/${item.id}/`);
        const deleteCase = deleteCaseAction.bind(null, item.id);

        return (
          <div className={isActive ? "sidebar-case-item active" : "sidebar-case-item"} key={item.id}>
            <Link
              aria-current={isActive ? "page" : undefined}
              className="sidebar-case-link"
              href={`/cases/${item.id}/intake`}
            >
              <strong>{item.title}</strong>
              <small>
                {formatCaseType(item.caseType)} · {formatCaseStatus(item.status)}
              </small>
              <span>{item.description}</span>
            </Link>
            <form action={deleteCase}>
              <input type="hidden" name="currentPath" value={pathname} />
              <button className="sidebar-delete-button" type="submit" aria-label={`${item.title} 삭제`} title="삭제">
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        );
      })}
    </nav>
  );
}
