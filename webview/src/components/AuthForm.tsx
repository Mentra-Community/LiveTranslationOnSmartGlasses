import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

export function AuthForm() {
  const { requestCode, verifyCode, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;

    try {
      const response = await requestCode(email);
      setRequestStatus(response.message);
      setStep("code");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || isLoading) return;

    try {
      console.log(`📤 Submitting verification code for ${email}`);
      const result = await verifyCode(email, code);
      console.log('✅ Verification successful:', result);
      
      // Show success state even before redirect
      setRequestStatus('Verification successful! Loading your account...');
    } catch (err) {
      console.error('❌ Verification error:', err);
      // Error already handled by auth state
    }
  };

  const handleGoBack = () => {
    setStep("email");
    setCode("");
    setRequestStatus(null);
  };

  return (
    <Card className="w-full max-w-md border border-secondary/30 shadow-sm">
      <CardHeader className="border-b border-secondary/30">
        <CardTitle>Authentication</CardTitle>
        <CardDescription>
          {step === "email" 
            ? "Enter your email to receive a verification code" 
            : "Enter the verification code"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <form onSubmit={handleEmailSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                {requestStatus && (
                  <div className={cn(
                    "p-3 mb-4 rounded-md text-sm",
                    requestStatus.includes("successful") 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-muted"
                  )}>
                    {requestStatus}
                  </div>
                )}
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {step === "email" ? (
          <Button 
            className="w-full" 
            disabled={!email || isLoading}
            onClick={handleEmailSubmit}
          >
            {isLoading ? "Requesting..." : "Request Code"}
          </Button>
        ) : (
          <>
            <Button 
              className="w-full" 
              disabled={!code || isLoading}
              onClick={handleCodeSubmit}
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoBack}
              disabled={isLoading}
            >
              Back
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}