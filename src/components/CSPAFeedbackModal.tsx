import { useState } from "react";
import { Star, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Lang = "es" | "en";

const T = {
  es: {
    title: "¿Cómo fue tu experiencia?",
    subtitle: "Tu opinión nos ayuda a mejorar la herramienta.",
    commentPh: "Cuéntanos más (opcional)…",
    submit: "Enviar evaluación",
    sending: "Enviando…",
    thanks: "¡Gracias por tu evaluación!",
    labels: ["Muy mala", "Mala", "Regular", "Buena", "Excelente"],
  },
  en: {
    title: "How was your experience?",
    subtitle: "Your feedback helps us improve the tool.",
    commentPh: "Tell us more (optional)…",
    submit: "Submit feedback",
    sending: "Sending…",
    thanks: "Thank you for your feedback!",
    labels: ["Very bad", "Bad", "Average", "Good", "Excellent"],
  },
};

interface CSPAFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculationId?: string;
  lang: Lang;
}

export default function CSPAFeedbackModal({
  open, onOpenChange, calculationId, lang,
}: CSPAFeedbackModalProps) {
  const t = T[lang];
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("cspa_feedback" as any).insert({
        calculation_id: calculationId || null,
        rating,
        comment: comment.trim() || null,
        user_id: user?.id || null,
      } as any);
      if (error) throw error;
      toast({ title: t.thanks });
      onOpenChange(false);
      setRating(0);
      setComment("");
    } catch {
      toast({ title: lang === "es" ? "Error al enviar" : "Failed to submit", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const displayRating = hoveredStar || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-accent/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <MessageSquare className="w-5 h-5 text-accent" />
            {t.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{t.subtitle}</p>

        <div className="space-y-4">
          {/* Star rating */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "w-8 h-8 transition-colors",
                      star <= displayRating
                        ? "text-accent fill-accent"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <span className="text-xs text-accent font-medium animate-fade-in">
                {t.labels[displayRating - 1]}
              </span>
            )}
          </div>

          {/* Comment */}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.commentPh}
            className="bg-secondary border-border resize-none h-20 text-sm"
            maxLength={500}
          />

          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
            className="w-full gradient-gold text-accent-foreground font-semibold"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.sending}</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />{t.submit}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
