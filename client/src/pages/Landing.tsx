import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Building2, 
  Users, 
  FileText, 
  Award, 
  Calculator,
  ArrowRight,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Shield,
  Clock
} from "lucide-react";
import { Link } from "wouter";
import semiLogo from "@/assets/semi-logo.svg";

export default function Landing() {
  const incentivePrograms = [
    {
      name: "Facility Renewables Assessment (FRA)",
      description: "Assessment of renewable energy opportunities at industrial facilities",
      maxIncentive: "$25,000",
      duration: "6-12 months",
      eligibility: "Industrial facilities with energy usage >1 GWh/year"
    },
    {
      name: "Small and Medium Enterprise (SME)",
      description: "Energy efficiency improvements for small to medium enterprises",
      maxIncentive: "$50,000",
      duration: "3-9 months",
      eligibility: "Businesses with <500 employees"
    },
    {
      name: "Energy Efficiency Assessment (EEA)",
      description: "Comprehensive energy audits and improvement recommendations",
      maxIncentive: "$15,000",
      duration: "3-6 months",
      eligibility: "Commercial and industrial facilities"
    },
    {
      name: "Emissions Reduction (EMIS)",
      description: "Projects focused on reducing greenhouse gas emissions",
      maxIncentive: "$100,000",
      duration: "12-24 months",
      eligibility: "Large industrial facilities"
    },
    {
      name: "Custom Rebates (CR)",
      description: "Custom incentives for unique energy efficiency projects",
      maxIncentive: "Variable",
      duration: "6-18 months",
      eligibility: "Case-by-case evaluation"
    }
  ];

  const applicationTypes = [
    {
      title: "Company Owner",
      description: "Register your company and manage multiple facilities",
      features: ["Company registration", "Facility management", "Team oversight", "Application tracking"],
      icon: Building2
    },
    {
      title: "Contractor",
      description: "Apply for contractor certification and manage projects",
      features: ["Contractor certification", "Project applications", "Document management", "Progress tracking"],
      icon: Users
    },
    {
      title: "Team Member",
      description: "Join your company's energy efficiency initiatives",
      features: ["Team collaboration", "Document sharing", "Project participation", "Status updates"],
      icon: FileText
    }
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: "Financial Incentives",
      description: "Receive substantial rebates for qualifying energy efficiency projects"
    },
    {
      icon: TrendingUp,
      title: "Energy Savings",
      description: "Reduce operational costs through improved energy efficiency"
    },
    {
      icon: Shield,
      title: "Professional Support",
      description: "Access to certified contractors and technical expertise"
    },
    {
      icon: Clock,
      title: "Streamlined Process",
      description: "Simple application process with dedicated support"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src={semiLogo} 
                alt="SEMI Program" 
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            Small and Medium Enterprise Incentive Program
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform Your Business with
            <span className="text-blue-600"> Energy Efficiency</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Access financial incentives and expert support to implement energy efficiency 
            improvements at your facility. Reduce costs, increase sustainability, and 
            enhance your competitive advantage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" className="text-lg px-8">
                Apply for Incentives
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-lg px-8">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose SEMI Program?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <benefit.icon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Incentive Programs */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Available Incentive Programs
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incentivePrograms.map((program, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <Badge variant="outline">{program.maxIncentive}</Badge>
                  </div>
                  <CardDescription>{program.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">{program.duration}</span>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Eligibility:</p>
                      <p className="text-sm font-medium">{program.eligibility}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Application Types */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Choose Your Registration Type
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {applicationTypes.map((type, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <type.icon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <CardTitle className="text-xl">{type.title}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {type.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth">
                    <Button className="w-full mt-6">
                      Register as {type.title}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Simple Application Process
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: "Register", description: "Create your account and complete profile" },
              { step: 2, title: "Apply", description: "Submit application for your chosen program" },
              { step: 3, title: "Review", description: "Our team reviews your application" },
              { step: 4, title: "Implement", description: "Begin your energy efficiency project" }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-xl font-semibold mb-2">{item.title}</h4>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-blue-600 text-white">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Start Your Energy Efficiency Journey?
          </h3>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of businesses already benefiting from SEMI program incentives. 
            Start your application today and unlock energy savings.
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Begin Application
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="h-6 w-6 text-blue-400" />
                <h4 className="text-xl font-bold">SEMI Program</h4>
              </div>
              <p className="text-gray-400">
                Empowering businesses through energy efficiency incentives and support.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Programs</h5>
              <ul className="space-y-2 text-gray-400">
                <li>Facility Renewables Assessment</li>
                <li>SME Energy Efficiency</li>
                <li>Energy Efficiency Assessment</li>
                <li>Emissions Reduction</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-gray-400">
                <li>Application Help</li>
                <li>Technical Assistance</li>
                <li>Contractor Network</li>
                <li>Program Guidelines</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contact</h5>
              <ul className="space-y-2 text-gray-400">
                <li>support@semiprogram.ca</li>
                <li>1-800-SEMI-HELP</li>
                <li>Monday - Friday, 8 AM - 6 PM</li>
              </ul>
            </div>
          </div>
          <Separator className="my-8 bg-gray-700" />
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400">
              © 2024 SEMI Program. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-white">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}