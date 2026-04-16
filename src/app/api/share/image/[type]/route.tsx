import { NextRequest } from "next/server";
import { publicConfig } from "@/config/public-config";
import { getShareImageResponse } from "@/neynar-farcaster-sdk/nextjs";

// Cache for 1 hour - query strings create separate cache entries
export const revalidate = 3600;

const { appEnv, heroImageUrl, imageUrl } = publicConfig;

const showDevWarning = appEnv !== "production";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  return getShareImageResponse(
    { type, heroImageUrl, imageUrl, showDevWarning },
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        padding: 48,
        background: "linear-gradient(160deg, #0a0a1a 0%, #12082a 60%, #0a0a1a 100%)",
      }}
    >
      {/* Top glow accent */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 30% 20%, rgba(120,60,220,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Content card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 640,
        }}
      >
        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: "bold",
            color: "#f5c518",
            letterSpacing: -1,
            lineHeight: 1,
            textShadow: "0 0 40px rgba(245,197,24,0.4), 0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          ChainQuest MMO
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: "600",
            color: "#a78bfa",
            letterSpacing: 1,
            textShadow: "0 0 20px rgba(167,139,250,0.4)",
          }}
        >
          Farcaster&apos;s First MMORPG
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            width: 320,
            height: 2,
            background: "linear-gradient(90deg, #f5c518 0%, rgba(167,139,250,0.4) 60%, transparent 100%)",
            borderRadius: 2,
          }}
        />

        {/* Body text */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Join 1000+ players and 10,000 AI agents in a persistent living world
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 24,
            fontWeight: "bold",
            color: "#f5c518",
            letterSpacing: 0.5,
            textShadow: "0 0 20px rgba(245,197,24,0.3)",
          }}
        >
          Forge your legend on-chain
        </div>
      </div>
    </div>,
  );
}
