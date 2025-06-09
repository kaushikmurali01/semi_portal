import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import semiLogo from "@/assets/semi-logo.svg";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  twoFactorToken: z.string().optional(),
});

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.enum(["company_owner", "contractor", "employee"]),
  companyName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.userType === "company_owner") {
    return data.companyName;
  }
  return true;
}, {
  message: "Company name is required for account owners",
  path: ["companyName"]
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [generatedShortName, setGeneratedShortName] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{email: string; password: string} | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // Password requirements checker
  const checkPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[^a-zA-Z0-9]/.test(password),
    };
  };

  const passwordRequirements = checkPasswordRequirements(passwordValue);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    }
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      userType: "company_owner",
      companyName: "",
    }
  });

  const userType = registerForm.watch("userType");
  
  // Watch company name to generate short name in real-time
  const companyName = registerForm.watch("companyName");

  // Update generated short name when company name changes
  React.useEffect(() => {
    if (companyName && userType === "company_owner") {
      const shortName = generateCompanyShortName(companyName);
      setGeneratedShortName(shortName);
    } else {
      setGeneratedShortName("");
    }
  }, [companyName, userType]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresTwoFactor) {
        // Store credentials and show 2FA input
        setLoginCredentials({ email: loginForm.getValues("email"), password: loginForm.getValues("password") });
        setRequiresTwoFactor(true);
        toast({
          title: "Two-factor authentication required",
          description: "Please enter your authenticator code to continue.",
        });
      } else {
        // Successful login
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/");
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error instanceof Error ? error.message : "Failed to log in",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresEmailVerification) {
        // Show verification code input screen
        setVerificationEmail(data.email);
        setShowVerification(true);
        toast({
          title: "Check your email!",
          description: "We've sent you a verification code to complete your registration.",
        });
      } else {
        // Registration complete, redirect to dashboard
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/");
        toast({
          title: "Welcome to SEMI!",
          description: "Your account has been created successfully.",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Failed to create account",
      });
    },
  });

  // Verification code submission mutation
  const verifyCodeMutation = useMutation({
    mutationFn: async (data: { email: string; code: string }) => {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Verification failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
      toast({
        title: "Welcome to SEMI!",
        description: "Your account has been verified successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Failed to verify code",
      });
    },
  });

  // Resend verification code mutation
  const resendCodeMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to resend code");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Code sent!",
        description: "A new verification code has been sent to your email.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: error instanceof Error ? error.message : "Failed to resend verification code",
      });
    },
  });



  // Function to generate company short name
  const generateCompanyShortName = (companyName: string): string => {
    if (!companyName) return "";
    
    // Remove spaces and special characters, convert to uppercase
    let shortName = companyName
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 6);
    
    // If less than 6 characters and original had spaces, try to use initials
    if (shortName.length < 6 && companyName.includes(' ')) {
      const words = companyName.split(/\s+/).filter(word => word.length > 0);
      if (words.length > 1) {
        const initials = words.map(word => word.charAt(0).toUpperCase()).join('');
        if (initials.length <= 6) {
          shortName = initials;
        }
      }
    }
    
    return shortName;
  };

  const onRegister = async (data: RegisterData) => {
    let finalData = { ...data };
    
    // If it's a company owner, generate the short name
    if (data.userType === "company_owner" && data.companyName) {
      const baseShortName = generateCompanyShortName(data.companyName);
      
      // Check for uniqueness and adjust if needed
      let shortName = baseShortName;
      let counter = 1;
      
      while (true) {
        try {
          // Check if this short name already exists
          const response = await fetch(`/api/companies/check-shortname?shortName=${shortName}`, {
            method: 'GET',
          });
          
          if (response.ok) {
            const result = await response.json();
            if (!result.exists) {
              // Short name is available
              break;
            }
          }
          
          // Generate a new variant
          if (counter === 1) {
            shortName = baseShortName.substring(0, 5) + counter;
          } else {
            const counterStr = counter.toString();
            shortName = baseShortName.substring(0, 6 - counterStr.length) + counterStr;
          }
          counter++;
          
          // Prevent infinite loops
          if (counter > 999) {
            shortName = baseShortName + Math.random().toString(36).substr(2, 2).toUpperCase();
            break;
          }
        } catch (error) {
          // If check fails, proceed with current short name
          break;
        }
      }
      
      finalData = { ...data, companyShortName: shortName } as any;
    }
    
    registerMutation.mutate(finalData);
  };

  const onLogin = async (data: LoginData) => {
    if (requiresTwoFactor && loginCredentials) {
      // Submit with 2FA token
      loginMutation.mutate({
        email: loginCredentials.email,
        password: loginCredentials.password,
        twoFactorToken: data.twoFactorToken
      });
    } else {
      // Initial login attempt
      loginMutation.mutate(data);
    }
  };

  const handleVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length === 6) {
      verifyCodeMutation.mutate({
        email: verificationEmail,
        code: verificationCode
      });
    }
  };

  const handleResendCode = () => {
    resendCodeMutation.mutate(verificationEmail);
  };

  // If showing verification screen, render that instead
  if (showVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a 6-digit verification code to<br />
              <strong>{verificationEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerificationSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                  }}
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyCodeMutation.isPending || verificationCode.length !== 6}
              >
                {verifyCodeMutation.isPending ? "Verifying..." : "Verify Email"}
              </Button>
              
              <div className="text-center text-sm text-gray-600">
                Didn't receive the code?{" "}
                <Button
                  type="button"
                  variant="ghost"
                  className="text-blue-600 hover:text-blue-800 p-0 h-auto font-normal"
                  onClick={handleResendCode}
                  disabled={resendCodeMutation.isPending}
                >
                  {resendCodeMutation.isPending ? "Sending..." : "Resend"}
                </Button>
              </div>
              
              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-800"
                  onClick={() => setShowVerification(false)}
                >
                  Back to registration
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4 relative">
      {/* SEMI Logo in top left */}
      <Link href="/">
        <div className="absolute top-6 left-6 cursor-pointer hover:opacity-80 transition-opacity">
          <img 
            src={semiLogo} 
            alt="SEMI Program" 
            className="h-16 w-auto object-contain"
          />
        </div>
      </Link>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to the SEMI Program Portal
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Enhancing energy efficiency for Alberta's industrial sector.
            </p>
            <p className="text-lg text-gray-700">
              Join the most comprehensive energy management program in North America, designed to help your business reduce costs and optimize energy use.
            </p>
          </div>
          
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Why participate in SEMI?</h3>
            <ul className="space-y-2 text-blue-800">
              <li>• Enhance profitability through strategic energy management</li>
              <li>• Lower operating costs and extend equipment lifespan</li>
              <li>• Collaborate with industry peers and share best practices</li>
              <li>• Access up to $1,000,000 in incentive funding per facility</li>
            </ul>
          </div>

          <div className="text-sm text-gray-600">
            <p className="font-semibold mb-2">Supported by:</p>
            <p>• Government of Alberta through the TIER fund ($10M)</p>
            <p>• Natural Resources Canada ($40M)</p>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="w-full max-w-md mx-auto">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>Log in to continue</CardTitle>
                  <CardDescription>
                    Access your SEMI program dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showLoginPassword ? "text" : "password"} 
                                  placeholder="Enter your password" 
                                  {...field} 
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                                >
                                  {showLoginPassword ? (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-gray-400" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {requiresTwoFactor && (
                        <FormField
                          control={loginForm.control}
                          name="twoFactorToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Two-Factor Authentication Code *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter 6-digit code from your authenticator app" 
                                  maxLength={6}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-sm text-gray-600">
                                Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
                              </p>
                            </FormItem>
                          )}
                        />
                      )}

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Logging in..." : requiresTwoFactor ? "Verify Code" : "Log In"}
                      </Button>
                      
                      <div className="text-center mt-4">
                        <Link href="/reset-password">
                          <Button variant="ghost" className="text-sm text-blue-600 hover:text-blue-800">
                            Forgot your password?
                          </Button>
                        </Link>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>Sign up and start saving</CardTitle>
                  <CardDescription>
                    Create your SEMI program account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="First name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Last name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type={showRegisterPassword ? "text" : "password"} 
                                    placeholder="Password" 
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setPasswordValue(e.target.value);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                  >
                                    {showRegisterPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              {passwordValue && (
                                <div className="mt-2 space-y-1">
                                  <div className="text-xs text-gray-600 mb-1">Password requirements:</div>
                                  <div className="space-y-1">
                                    <div className={`flex items-center text-xs ${passwordRequirements.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${passwordRequirements.minLength ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      At least 8 characters
                                    </div>
                                    <div className={`flex items-center text-xs ${passwordRequirements.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${passwordRequirements.hasLowercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      One lowercase letter
                                    </div>
                                    <div className={`flex items-center text-xs ${passwordRequirements.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${passwordRequirements.hasUppercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      One uppercase letter
                                    </div>
                                    <div className={`flex items-center text-xs ${passwordRequirements.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${passwordRequirements.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      One number
                                    </div>
                                    <div className={`flex items-center text-xs ${passwordRequirements.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${passwordRequirements.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      One special character
                                    </div>
                                  </div>
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    placeholder="Confirm password" 
                                    {...field} 
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="userType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Type *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="company_owner" id="company_owner" />
                                    <Label htmlFor="company_owner" className="cursor-pointer font-medium">
                                      Account Owner
                                    </Label>
                                  </div>
                                  <p className="text-sm text-gray-600 ml-6">
                                    Create a primary SEMI Portal account for your organization. For new participant companies enrolling in SEMI activities, as well as contracting companies providing services to participants.
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="employee" id="employee" />
                                    <Label htmlFor="employee" className="cursor-pointer font-medium">
                                      Team Member
                                    </Label>
                                  </div>
                                  <p className="text-sm text-gray-600 ml-6">
                                    Join an existing company account. You'll need to be invited by your company administrator.
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="contractor" id="contractor" />
                                    <Label htmlFor="contractor" className="cursor-pointer font-medium">
                                      Contractor
                                    </Label>
                                  </div>
                                  <p className="text-sm text-gray-600 ml-6">
                                    Independent contractor providing services to SEMI participants.
                                  </p>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {userType === "company_owner" && (
                        <>
                          <FormField
                            control={registerForm.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your company name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="space-y-2">
                            <Label>Company Short Name (Auto-generated)</Label>
                            <Input 
                              value={generatedShortName}
                              readOnly
                              disabled
                              placeholder="Will be generated from company name"
                              className="bg-gray-50 text-gray-700"
                            />
                            <p className="text-xs text-gray-500">
                              This short name will be automatically generated and used for system identification
                            </p>
                          </div>
                        </>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}