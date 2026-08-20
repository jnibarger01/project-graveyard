import { createFileRoute, Link } from "@tanstack/react-router";
import { ProjectDetail } from "@/components/project-detail";
import { useGraveyard } from "@/lib/store";

export const Route = createFileRoute("/_app/projects/$id")({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const repo = useGraveyard((s) => s.repos.find((r) => r.id === id));
  if (!repo) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-serif text-3xl">Not in this graveyard</h1>
        <p className="mt-2 text-sm text-muted">That project is not in the current dataset.</p>
        <Link to="/projects" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }
  return <ProjectDetail repo={repo} />;
}
