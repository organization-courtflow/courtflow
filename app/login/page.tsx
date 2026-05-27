import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { signInAction } from "@/app/login/actions";
import PasswordField from "@/components/PasswordField";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;

  return (
    <section className="auth-stage">
      <div className="auth-orb one" />
      <div className="auth-orb two" />
      <div className="auth-card">
        <div className="auth-form-panel">
          <Link
            href="/login"
            className="auth-brand"
            aria-label="CourtFlow AI 로그인"
          >
            <Image src="/logo.svg" alt="" width={44} height={44} priority />
            <span>CourtFlow AI</span>
          </Link>
          <div className="auth-copy">
            <h1>로그인</h1>
            <span>
              사건 정리, 증거 검토, 상담 리포트를 내 계정에 안전하게 저장합니다.
            </span>
          </div>

          <form className="auth-form" action={signInAction}>
            {message ? <p className="inline-alert">{message}</p> : null}
            <div className="field auth-field">
              <label htmlFor="signin-email">이메일</label>
              <Mail size={18} aria-hidden="true" />
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <PasswordField
              id="signin-password"
              autoComplete="current-password"
            />
            <button className="button auth-submit" type="submit">
              로그인
            </button>
            <p className="auth-link">
              아직 계정이 없다면 <Link href="/signin">회원가입</Link>
            </p>
          </form>
        </div>

        <div className="auth-art-panel">
          <div className="auth-art-card">
            <Image
              src="/dike-justice.svg"
              alt="정의의 여신 디케 일러스트"
              width={760}
              height={760}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
