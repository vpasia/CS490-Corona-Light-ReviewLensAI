import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-4 py-12">
      <p className="text-2xl font-semibold text-[#1F1F1F]">ReviewLens</p>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
