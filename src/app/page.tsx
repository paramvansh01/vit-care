import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { currentUser, homeFor } from "@/lib/auth";
import { campuses, departments, specialisations } from "@/lib/care";
import { scalar } from "@/lib/db";
import { lanUrls } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  const { next } = await searchParams;
  if (user) redirect(next?.startsWith("/") ? next : homeFor(user.role));

  return (
    <AuthScreen
      next={next ?? ""}
      campusList={campuses()}
      deptList={departments()}
      specs={specialisations()}
      counts={{
        students: scalar<number>("SELECT COUNT(*) FROM student"),
        doctors: scalar<number>("SELECT COUNT(*) FROM doctor"),
        accounts: scalar<number>("SELECT COUNT(*) FROM app_user WHERE password_hash IS NOT NULL"),
      }}
      lanUrls={lanUrls()}
    />
  );
}
