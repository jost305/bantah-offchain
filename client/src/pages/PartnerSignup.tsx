import { useState, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Handshake, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PartnerSignup() {
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [communityCoverFile, setCommunityCoverFile] = useState<File | null>(null);
  const [communityCoverPreview, setCommunityCoverPreview] = useState("");
  const [communityCoverImageUrl, setCommunityCoverImageUrl] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    facebook: "",
    twitter: "",
    instagram: "",
    tiktok: "",
    youtube: "",
  });
  const [notes, setNotes] = useState("");
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const hasAnySocialLink = Object.values(socialLinks).some((value) => value.trim().length > 0);

  const uploadCommunityCover = async (file: File): Promise<string> => {
    setIsUploadingCover(true);
    try {
      const form = new FormData();
      form.append("image", file);

      const response = await fetch("/api/partners/signup-cover-upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to upload community cover art");
      }

      const payload = await response.json();
      const imageUrl = String(payload?.imageUrl || "");
      if (!imageUrl) throw new Error("Upload did not return an image URL");
      setCommunityCoverImageUrl(imageUrl);
      return imageUrl;
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setCommunityCoverFile(file);
    setCommunityCoverImageUrl("");

    if (!file) {
      setCommunityCoverPreview("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCommunityCoverPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const submitApplication = useMutation({
    mutationFn: async () => {
      let coverImageUrl = communityCoverImageUrl.trim();
      if (communityCoverFile && !coverImageUrl) {
        coverImageUrl = await uploadCommunityCover(communityCoverFile);
      }

      return apiRequest("POST", "/api/partners/signup-applications", {
        fullName: fullName.trim(),
        email: email.trim(),
        communityName: communityName.trim(),
        roleTitle: roleTitle.trim() || undefined,
        phone: phone.trim() || undefined,
        telegramHandle: telegramHandle.trim() || undefined,
        website: website.trim() || undefined,
        communityCoverImageUrl: coverImageUrl || undefined,
        socialLinks: {
          facebook: socialLinks.facebook.trim() || undefined,
          twitter: socialLinks.twitter.trim() || undefined,
          instagram: socialLinks.instagram.trim() || undefined,
          tiktok: socialLinks.tiktok.trim() || undefined,
          youtube: socialLinks.youtube.trim() || undefined,
        },
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (response: any) => {
      setSubmittedId(Number(response?.application?.id || 0) || null);
      toast({
        title: "Application submitted",
        description: "Your partner request is in review. We will contact you.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitApplication = () => {
    if (!hasAnySocialLink) {
      toast({
        title: "Community links required",
        description: "Add at least one community social link (Facebook, X/Twitter, Instagram, TikTok, or YouTube).",
        variant: "destructive",
      });
      return;
    }
    submitApplication.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <Badge className="bg-[#ccff00]/30 text-slate-900 border border-[#ccff00]/50 hover:bg-[#ccff00]/30">Partner Signup</Badge>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">Launch your community challenge campaign</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Apply as a partner to create managed challenges for your audience, track fee earnings, and operate from your partner dashboard.
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1"><CheckCircle2 className="w-3.5 h-3.5" /> Dedicated dashboard</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1"><CheckCircle2 className="w-3.5 h-3.5" /> Partner fee settlement</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1"><CheckCircle2 className="w-3.5 h-3.5" /> Withdrawal requests</span>
          </div>
        </section>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Handshake className="w-4 h-4" />
              Partner Application Form
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submittedId ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Application received</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Reference ID: #{submittedId}</p>
                <div className="flex gap-2 mt-3">
                  {isAuthenticated ? (
                    <Button className="h-9 text-xs font-bold uppercase tracking-wide border-0" onClick={() => navigate("/partners")}>Open Partner Dashboard</Button>
                  ) : (
                    <Button className="h-9 text-xs font-bold uppercase tracking-wide border-0" onClick={() => login()}>Sign In</Button>
                  )}
                  <Button variant="outline" className="h-9 text-xs font-bold uppercase tracking-wide" onClick={() => navigate("/challenges")}>Explore Challenges</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@community.com" className="h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Community Name</Label>
                    <Input value={communityName} onChange={(e) => setCommunityName(e.target.value)} placeholder="XYZ Sports Hub" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Your Role</Label>
                    <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Founder / Admin" className="h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telegram</Label>
                    <Input value={telegramHandle} onChange={(e) => setTelegramHandle(e.target.value)} placeholder="@yourhandle" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="h-10" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Community Cover Art</Label>
                  <Input type="file" accept="image/*" onChange={handleCoverFileChange} className="h-10 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs dark:file:bg-slate-800" />
                  <p className="text-[11px] text-slate-500">Upload JPG, PNG, GIF, or WebP. Max size: 8MB.</p>
                  {communityCoverPreview ? (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-xs">
                      <img src={communityCoverPreview} alt="Community cover preview" className="w-full h-28 object-cover" />
                    </div>
                  ) : null}
                  {communityCoverImageUrl ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Cover art ready</p> : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Community Social Links</Label>
                    <span className="text-[11px] text-slate-500">At least one required</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={socialLinks.facebook}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, facebook: e.target.value }))}
                      placeholder="Facebook link (https://facebook.com/...)"
                      className="h-10"
                    />
                    <Input
                      value={socialLinks.twitter}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, twitter: e.target.value }))}
                      placeholder="X / Twitter link (https://x.com/...)"
                      className="h-10"
                    />
                    <Input
                      value={socialLinks.instagram}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }))}
                      placeholder="Instagram link (https://instagram.com/...)"
                      className="h-10"
                    />
                    <Input
                      value={socialLinks.tiktok}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, tiktok: e.target.value }))}
                      placeholder="TikTok link (https://tiktok.com/@...)"
                      className="h-10"
                    />
                    <Input
                      value={socialLinks.youtube}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, youtube: e.target.value }))}
                      placeholder="YouTube link (https://youtube.com/...)"
                      className="h-10 md:col-span-2"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>What do you want to run on Bantah?</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tell us expected audience size, challenge categories, campaign goals, and payout preferences."
                    className="min-h-[120px]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <p className="text-xs text-slate-500">By applying, you agree to partner onboarding review and compliance checks.</p>
                  <Button
                    onClick={handleSubmitApplication}
                    disabled={
                      submitApplication.isPending ||
                      isUploadingCover ||
                      fullName.trim().length < 2 ||
                      email.trim().length < 5 ||
                      communityName.trim().length < 2 ||
                      !hasAnySocialLink
                    }
                    className="h-10 text-xs font-bold uppercase tracking-wide border-0"
                  >
                    {submitApplication.isPending || isUploadingCover ? "Submitting..." : "Submit Application"}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
