import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { BrixLogo } from "@/components/common/BrixLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <AuthBackground>
      <div className="max-w-sm w-full text-center">
        <BrixLogo height="4rem" color="white" className="mx-auto mb-6" />
        <p
          className="font-landing font-medium text-white leading-none mb-3"
          style={{ fontSize: 'clamp(3rem, 16vw, 4.5rem)' }}
        >
          404
        </p>
        <h1 className="text-xl font-display font-bold text-on-bg-text mb-2">Page not found</h1>
        <p className="text-sm text-on-bg-body mb-8">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link to="/">
          <Button size="lg" className="bg-action-primary hover:bg-action-primary-hover text-white">
            Return to Home
          </Button>
        </Link>
      </div>
    </AuthBackground>
  );
};

export default NotFound;
