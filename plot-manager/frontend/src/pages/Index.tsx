import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectDialog from '@/components/CreateProjectDialog';
import Header from '@/components/Header';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const Index = () => {
  const { projects, setCurrentProject, isAdmin, isInitialized } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectClick = (project: typeof projects[0]) => {
    setCurrentProject(project);
    navigate(`/project/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 py-8">
        {/* Show loading skeleton only during initialization */}
        {!isInitialized && (
          <div className="space-y-8">
            <div className="text-center mb-12">
              <div className="h-12 bg-muted rounded-lg w-64 mx-auto mb-4 animate-pulse" />
              <div className="h-8 bg-muted rounded-lg w-96 mx-auto animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 bg-muted rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Actual content (hidden during initialization) */}
        <div className={!isInitialized ? 'invisible' : ''}>
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Plot Management <span className="text-gradient">System</span>
            </h1>
          </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {isAdmin && <CreateProjectDialog />}
        </div>

        {/* Projects Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border rounded-2xl shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : isAdmin
                ? 'Create your first project to get started'
                : 'Login as admin to create projects'}
            </p>
            {isAdmin && !searchQuery && <CreateProjectDialog />}
          </div>
        )}

        {/* Stats Summary */}
        {projects.length > 0 && (
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <div className="text-3xl font-bold text-foreground">{projects.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Projects</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <div className="text-3xl font-bold text-status-available">
                {projects.reduce((acc, p) => acc + p.plots.filter((pl) => pl.status === 'available').length, 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Available Plots</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <div className="text-3xl font-bold text-status-booked">
                {projects.reduce((acc, p) => acc + p.plots.filter((pl) => pl.status === 'booked').length, 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Booked Plots</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <div className="text-3xl font-bold text-status-sold">
                {projects.reduce((acc, p) => acc + p.plots.filter((pl) => pl.status === 'sold').length, 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Sold Plots</div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} PlotManager. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
