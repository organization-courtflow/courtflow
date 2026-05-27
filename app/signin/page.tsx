import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { signUpAction } from "@/app/login/actions";
import PasswordField from "@/components/PasswordField";

type SignInPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
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
            <h1>회원가입</h1>
            <span>
              계정을 만들면 사건과 입력 자료가 내 계정 기준으로 저장됩니다.
            </span>
          </div>

          <form className="auth-form" action={signUpAction}>
            {message ? <p className="inline-alert">{message}</p> : null}
            <div className="field auth-field">
              <label htmlFor="signup-email">이메일</label>
              <Mail size={18} aria-hidden="true" />
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <PasswordField
              id="signup-password"
              autoComplete="new-password"
              minLength={6}
            />
            <button className="button auth-submit" type="submit">
              회원가입
            </button>
            <p className="auth-link">
              이미 계정이 있다면 <Link href="/login">로그인</Link>
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
