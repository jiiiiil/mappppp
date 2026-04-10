import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Building2, CheckCircle2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function Landing() {
  const { user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Plot Management Platform</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Manage projects.
              <br />
              Track plots.
              <br />
              <span className="text-gradient">Close deals faster.</span>
            </h1>

            <p className="text-lg text-muted-foreground mt-5 max-w-xl">
              A clean dashboard to manage real estate projects with layout overlays, plot status tracking, and map-based viewing.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">Login</Button>
              </Link>
            </div>

            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Admin can create projects and manage plots</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Users can view project layouts and plot info</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Map overlay saved per project</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Projects Dashboard</div>
                  <div className="text-sm text-muted-foreground mt-1">Centralized overview for all projects and quick navigation to plots.</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Map View</div>
                  <div className="text-sm text-muted-foreground mt-1">Configure and view project map overlays with corners, opacity, and flips.</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Role-based access</div>
                  <div className="text-sm text-muted-foreground mt-1">Admins can edit and save; users can safely view.</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="container px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} PlotManager. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
