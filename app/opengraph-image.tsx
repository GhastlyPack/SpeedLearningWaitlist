import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "SpeedLearning — learn anything in 30 to 60 minutes. Type a topic, get a TLDR, report, slide deck, mind map, flashcards, and an AI chat partner.";

export default async function OpengraphImage() {
  const [plexBold, plexReg, iconData] = await Promise.all([
    fetch(new URL("./IBMPlexSans-SemiBold.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL("./IBMPlexSans-Regular.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL("./og-icon.png", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
  ]);

  const iconBase64 = `data:image/png;base64,${Buffer.from(iconData).toString(
    "base64"
  )}`;

  const BG = "#f4efe6";
  const INK = "#1a1813";
  const INK_SOFT = "#5a4f3f";
  const INK_MUTE = "#8a7e6b";
  const AX = "#8b2c2c";
  const RULE = "rgba(26, 24, 19, 0.10)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: INK,
          display: "flex",
          flexDirection: "column",
          padding: 64,
          fontFamily: "Plex",
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconBase64}
            width={60}
            height={60}
            alt=""
            style={{ display: "block" }}
          />
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: -0.4,
              color: INK,
            }}
          >
            SpeedLearning
          </div>
        </div>

        {/* Hero block */}
        <div
          style={{
            marginTop: "auto",
            marginBottom: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: -2,
              lineHeight: 1.0,
              color: INK,
            }}
          >
            Learn anything
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: -2,
              lineHeight: 1.0,
              color: AX,
              marginTop: 4,
            }}
          >
            in 30 to 60 minutes.
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.4,
              color: INK_SOFT,
              marginTop: 32,
              maxWidth: 980,
            }}
          >
            Type a topic. Get a TLDR, full report, slide deck, mind map,
            flashcards, and an AI chat partner trained on every source.
          </div>
        </div>

        {/* Hairline + footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 1,
              background: RULE,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: INK_MUTE,
              fontWeight: 400,
            }}
          >
            <div style={{ display: "flex" }}>speedlearning.com</div>
            <div style={{ display: "flex" }}>Waitlist · 2026</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex", data: plexBold, weight: 600, style: "normal" },
        { name: "Plex", data: plexReg, weight: 400, style: "normal" },
      ],
    }
  );
}
