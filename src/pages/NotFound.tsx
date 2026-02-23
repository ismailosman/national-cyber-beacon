import { motion } from "framer-motion";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Decorative Background Element */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-[20rem] sm:text-[28rem] font-black text-foreground leading-none"
        >
          404
        </motion.div>
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* Animated 404 Text */}
        <motion.h1
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-7xl sm:text-8xl font-black text-primary tracking-tight"
        >
          404
        </motion.h1>

        {/* Messaging */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-6 space-y-3"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Lost in the digital void?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            The page you're looking for has vanished or never existed.
            Let's get you back on the right track.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button
            size="lg"
            className="gap-2"
            onClick={() => (window.location.href = "/")}
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </motion.div>

        {/* Optional Search Prompt */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10 text-sm text-muted-foreground flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          Need help finding something? Search our site
        </motion.p>
      </div>
    </div>
  );
};

export default NotFound;
