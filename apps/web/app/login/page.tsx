import Image from "next/image";
import { assets } from "@/components/landing/assets";

const CHECK = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5L6.5 12L13 4.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LoginPage() {
  return (
    <div style={{ width: "100%", overflowX: "auto", background: "#F9F9FF" }}>
      <div
        style={{
          position: "relative",
          width: 1280,
          height: 2030,
          overflowY: "scroll",
          background: "linear-gradient(0deg, #F9F9FF, #F9F9FF), #FFFFFF",
          margin: "0 auto"
        }}
      >
        {/* Top Navigation Bar */}
        <div
          style={{
            position: "absolute",
            width: 1280,
            height: 64,
            left: 0,
            top: 0,
            background: "#F9F9FF",
            borderBottom: "1px solid #C6C5D1",
            boxSizing: "border-box"
          }}
        >
          <a
            href="/"
            aria-label="Obligon home"
            style={{ position: "absolute", width: 93, height: 62, left: 64, top: 0.5 }}
          >
            <Image src={assets.obligonLogo} width={93} height={62} alt="Obligon" style={{ objectFit: "contain" }} />
          </a>
          <div style={{ position: "absolute", width: 52, height: 20, left: 1164, top: 21.5, display: "flex", gap: 16 }}>
            <span style={{ width: 16, height: 20, background: "#454650" }} />
            <span style={{ width: 20, height: 20, background: "#454650" }} />
          </div>
        </div>

        {/* Main */}
        <div style={{ position: "absolute", width: 1280, height: 1664, left: 0, top: 64 }}>
          {/* Sidebar */}
          <div style={{ position: "absolute", width: 426.66, height: 1664, left: 0, top: 0, background: "#011554" }}>
            <div style={{ position: "absolute", width: 330.66, height: 455, left: 48, top: 1161 }}>
              <div style={{ position: "absolute", width: 330.66, height: 247, left: 0, top: 0 }}>
                <h1
                  style={{
                    position: "absolute",
                    width: 330.66,
                    height: 240,
                    left: 0,
                    top: 7,
                    fontFamily: "'Plus Jakarta Sans'",
                    fontWeight: 800,
                    fontSize: 48,
                    lineHeight: "60px",
                    display: "flex",
                    alignItems: "center",
                    letterSpacing: "-0.96px",
                    color: "#FFFFFF",
                    margin: 0
                  }}
                >
                  Fueling Nigeria&apos;s Infrastructure.
                </h1>
              </div>

              <div style={{ position: "absolute", width: 330.66, height: 112, left: 0, top: 271 }}>
                <p
                  style={{
                    width: 330,
                    height: 112,
                    margin: 0,
                    fontFamily: "'Inter'",
                    fontWeight: 400,
                    fontSize: 18,
                    lineHeight: "28px",
                    display: "flex",
                    alignItems: "center",
                    color: "rgba(255, 255, 255, 0.7)"
                  }}
                >
                  Join over 850+ partner stations across the nation. Manage disbursements, track inventory, and grow your
                  retail volume.
                </p>
              </div>

              <div style={{ position: "absolute", width: 330.66, height: 48, left: 0, top: 407 }}>
                <div style={{ position: "absolute", width: 104, height: 40, left: 0, top: 8 }}>
                  <span
                    style={{
                      position: "absolute",
                      width: 40,
                      height: 40,
                      left: 0,
                      top: 0,
                      background: "#D4E3FF",
                      border: "2px solid #011554",
                      borderRadius: 9999,
                      boxSizing: "border-box"
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      width: 40,
                      height: 40,
                      left: 32,
                      top: 0,
                      background: "#C9DBFA",
                      border: "2px solid #011554",
                      borderRadius: 9999,
                      boxSizing: "border-box"
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      width: 40,
                      height: 40,
                      left: 64,
                      top: 0,
                      background: "#AAF857",
                      border: "2px solid #011554",
                      borderRadius: 9999,
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ position: "absolute", width: 124.2, height: 16, left: 120, top: 20 }}>
                  <span
                    style={{
                      fontFamily: "'Inter'",
                      fontWeight: 600,
                      fontSize: 12,
                      lineHeight: "16px",
                      display: "flex",
                      alignItems: "center",
                      letterSpacing: "0.6px",
                      color: "rgba(255, 255, 255, 0.5)"
                    }}
                  >
                    850+ Verified Partners
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div
            style={{
              position: "absolute",
              width: 853.34,
              height: 1664,
              left: 426.66,
              top: 0,
              overflow: "scroll",
              background: "#EFF3FF"
            }}
          >
            <div style={{ position: "absolute", width: 672, maxWidth: 672, height: 1568, left: 90.67, top: 48 }}>
              {/* Section: Login */}
              <div
                style={{
                  position: "absolute",
                  width: 672,
                  height: 420,
                  left: 0,
                  top: 0,
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  boxSizing: "border-box"
                }}
              >
                <div style={{ position: "absolute", width: 606, height: 56, left: 33, top: 33 }}>
                  <div style={{ position: "absolute", width: 254.36, height: 56, left: 0, top: 0 }}>
                    <h2
                      style={{
                        position: "absolute",
                        width: 154.72,
                        height: 32,
                        left: 0,
                        top: 0,
                        fontFamily: "'Plus Jakarta Sans'",
                        fontWeight: 700,
                        fontSize: 24,
                        lineHeight: "32px",
                        display: "flex",
                        alignItems: "center",
                        color: "#081C33",
                        margin: 0
                      }}
                    >
                      Log in
                    </h2>
                    <p
                      style={{
                        position: "absolute",
                        width: 254.36,
                        height: 20,
                        left: 0,
                        top: 36,
                        fontFamily: "'Inter'",
                        fontWeight: 400,
                        fontSize: 14,
                        lineHeight: "20px",
                        display: "flex",
                        alignItems: "center",
                        color: "#454650",
                        margin: 0
                      }}
                    >
                      Access your Obligon dashboard and stations.
                    </p>
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      width: 28.75,
                      height: 15,
                      left: 577.25,
                      top: 20.5,
                      background: "#3D6A00"
                    }}
                  />
                </div>

                <div style={{ position: "absolute", width: 606, height: 266, left: 33, top: 121 }}>
                  {/* Email */}
                  <div style={{ position: "absolute", width: 606, height: 81, left: 0, top: 0 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 122,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Corporate Email
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 606,
                        height: 57,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        type="email"
                        placeholder="admin@fuelstation.ng"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 20,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ position: "absolute", width: 606, height: 81, left: 0, top: 105 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 73.56,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Password
                    </label>
                    <a
                      href="#forgot"
                      style={{
                        position: "absolute",
                        width: 48.25,
                        height: 16,
                        left: 557.75,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        color: "#3D6A00",
                        textDecoration: "none"
                      }}
                    >
                      Forgot?
                    </a>
                    <div
                      style={{
                        position: "absolute",
                        width: 606,
                        height: 57,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        type="password"
                        placeholder="••••••••"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 20,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Login Button */}
                  <a
                    href="#dashboard"
                    style={{
                      position: "absolute",
                      width: 606,
                      height: 56,
                      left: 0,
                      top: 210,
                      background: "#3D6A00",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      textDecoration: "none"
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter'",
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: "24px",
                        color: "#FFFFFF"
                      }}
                    >
                      Log in
                    </span>
                    <span style={{ width: 16, height: 16, background: "#FFFFFF" }} />
                  </a>
                </div>

                {/* Divider */}
                <div style={{ position: "absolute", width: 672, height: 1, left: 0, top: 468 }}>
                  <div style={{ position: "absolute", width: 672, height: 1, left: 0, top: 0, background: "#C6C5D1" }} />
                  <div
                    style={{
                      position: "absolute",
                      width: 151.84,
                      height: 16,
                      left: 260.08,
                      top: -7.5,
                      background: "#EFF3FF"
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        width: 119.84,
                        height: 16,
                        left: 16,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        display: "flex",
                        alignItems: "center",
                        letterSpacing: "0.6px",
                        color: "#454650"
                      }}
                    >
                      OR CONTINUE WITH
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Partner Application */}
              <div
                style={{
                  position: "absolute",
                  width: 672,
                  height: 561,
                  left: -0.33,
                  top: 517,
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  boxSizing: "border-box"
                }}
              >
                <div style={{ position: "absolute", width: 144.41, height: 109.29, left: 539.44, top: -34.15 }}>
                  <div
                    style={{
                      position: "absolute",
                      width: 131.56,
                      height: 23,
                      left: 35.13,
                      top: 0,
                      background: "#3D6A00",
                      transform: "rotate(45deg)"
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      width: 67.56,
                      height: 15,
                      left: 25.46,
                      top: 25.46,
                      fontFamily: "'Inter'",
                      fontWeight: 700,
                      fontSize: 10,
                      lineHeight: "15px",
                      display: "flex",
                      alignItems: "center",
                      textAlign: "center",
                      letterSpacing: "-0.5px",
                      textTransform: "uppercase",
                      color: "#FFFFFF",
                      transform: "rotate(45deg)"
                    }}
                  >
                    Partner
                  </span>
                </div>

                <div style={{ position: "absolute", width: 606, height: 56, left: 33, top: 13 }}>
                  <h2
                    style={{
                      position: "absolute",
                      width: 247,
                      height: 32,
                      left: 0,
                      top: 0,
                      fontFamily: "'Plus Jakarta Sans'",
                      fontWeight: 700,
                      fontSize: 24,
                      lineHeight: "32px",
                      display: "flex",
                      alignItems: "center",
                      color: "#081C33",
                      margin: 0
                    }}
                  >
                    Apply for Partnership
                  </h2>
                  <p
                    style={{
                      position: "absolute",
                      width: 276,
                      height: 20,
                      left: 0,
                      top: 36,
                      fontFamily: "'Inter'",
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: "20px",
                      display: "flex",
                      alignItems: "center",
                      color: "#454650",
                      margin: 0
                    }}
                  >
                    Submit your station details for verification
                  </p>
                </div>

                <div style={{ position: "absolute", width: 606, height: 270, left: 33, top: 101 }}>
                  {/* Station Name */}
                  <div style={{ position: "absolute", width: 291, height: 73, left: 0, top: 0 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 98,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Station Name
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 291,
                        height: 49,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        placeholder="e.g. Lagos Central Hub"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 13,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Primary Location */}
                  <div style={{ position: "absolute", width: 291, height: 73, left: 315, top: 0 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 128,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Primary Location
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 291,
                        height: 49,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          width: 9.33,
                          height: 11.67,
                          left: 12,
                          top: 14.7,
                          background: "#454650"
                        }}
                      />
                      <input
                        placeholder="Ikeja, Lagos"
                        style={{
                          position: "absolute",
                          width: 237,
                          height: 19,
                          left: 41,
                          top: 15,
                          border: "none",
                          background: "transparent",
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Contact Person */}
                  <div style={{ position: "absolute", width: 291, height: 73, left: 0, top: 98 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 119,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Contact Person
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 291,
                        height: 49,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        placeholder="Full legal name"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 13,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div style={{ position: "absolute", width: 291, height: 73, left: 0, top: 196 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 104,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Email Address
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 291,
                        height: 49,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        placeholder="Email Address"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 13,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div style={{ position: "absolute", width: 291, height: 73, left: 315, top: 98 }}>
                    <label
                      style={{
                        position: "absolute",
                        width: 104,
                        height: 16,
                        left: 0,
                        top: 0,
                        fontFamily: "'Inter'",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: "16px",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        color: "#081C33"
                      }}
                    >
                      Phone Number
                    </label>
                    <div
                      style={{
                        position: "absolute",
                        width: 291,
                        height: 49,
                        left: 0,
                        top: 24,
                        background: "#F9F9FF",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        placeholder="+234..."
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          paddingLeft: 13,
                          fontFamily: "'Inter'",
                          fontWeight: 400,
                          fontSize: 16,
                          lineHeight: "19px",
                          color: "#6B7280",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Fuel Types */}
                <div style={{ position: "absolute", width: 606, height: 76, left: 33, top: 385 }}>
                  <label
                    style={{
                      position: "absolute",
                      width: 152,
                      height: 16,
                      left: 0,
                      top: 0,
                      fontFamily: "'Inter'",
                      fontWeight: 600,
                      fontSize: 12,
                      lineHeight: "16px",
                      letterSpacing: "0.6px",
                      textTransform: "uppercase",
                      color: "#081C33"
                    }}
                  >
                    Available Fuel Types
                  </label>
                  <div style={{ position: "absolute", width: 606, height: 44, left: 0, top: 32, display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 130.02,
                        height: 44,
                        background: "rgba(170, 248, 87, 0.2)",
                        border: "1px solid #3D6A00",
                        borderRadius: 12,
                        boxSizing: "border-box",
                        position: "relative",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ position: "absolute", left: 12, top: 13, width: 18, height: 18, background: "#3D6A00", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {CHECK}
                      </span>
                      <span style={{ position: "absolute", left: 37, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", letterSpacing: "0.6px", color: "#081C33" }}>
                        PMS
                      </span>
                    </div>
                    <div
                      style={{
                        width: 131.67,
                        height: 44,
                        background: "rgba(170, 248, 87, 0.2)",
                        border: "1px solid #3D6A00",
                        borderRadius: 12,
                        boxSizing: "border-box",
                        position: "relative",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ position: "absolute", left: 12, top: 13, width: 18, height: 18, background: "#3D6A00", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {CHECK}
                      </span>
                      <span style={{ position: "absolute", left: 37, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", letterSpacing: "0.6px", color: "#081C33" }}>
                        AGO
                      </span>
                    </div>
                    <div
                      style={{
                        width: 150.22,
                        height: 44,
                        border: "1px solid #E2E8F0",
                        borderRadius: 12,
                        boxSizing: "border-box",
                        position: "relative",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ position: "absolute", left: 13, top: 14, width: 16, height: 16, background: "#FFFFFF", border: "1px solid #6B7280", borderRadius: 8, boxSizing: "border-box" }} />
                      <span style={{ position: "absolute", left: 37, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", letterSpacing: "0.6px", color: "#081C33" }}>
                        DPK
                      </span>
                    </div>
                    <div
                      style={{
                        width: 113.38,
                        height: 44,
                        border: "1px solid #E2E8F0",
                        borderRadius: 12,
                        boxSizing: "border-box",
                        position: "relative",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ position: "absolute", left: 13, top: 14, width: 16, height: 16, background: "#FFFFFF", border: "1px solid #6B7280", borderRadius: 8, boxSizing: "border-box" }} />
                      <span style={{ position: "absolute", left: 37, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", letterSpacing: "0.6px", color: "#081C33" }}>
                        LPG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <a
                  href="#submit"
                  style={{
                    position: "absolute",
                    width: 606,
                    height: 60,
                    left: 33,
                    top: 483,
                    border: "2px solid #00010C",
                    borderRadius: 12,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none"
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Inter'",
                      fontWeight: 700,
                      fontSize: 16,
                      lineHeight: "24px",
                      color: "#00010C"
                    }}
                  >
                    Submit Application
                  </span>
                </a>
              </div>

              {/* Section: Status Tracker */}
              <div style={{ position: "absolute", width: 672, height: 341, left: 0, top: 1091 }}>
                <div style={{ position: "absolute", width: 672, height: 32, left: 0, top: 0 }}>
                  <h3
                    style={{
                      position: "absolute",
                      width: 226.09,
                      height: 32,
                      left: 0,
                      top: 0,
                      fontFamily: "'Plus Jakarta Sans'",
                      fontWeight: 700,
                      fontSize: 24,
                      lineHeight: "32px",
                      display: "flex",
                      alignItems: "center",
                      color: "#081C33",
                      margin: 0
                    }}
                  >
                    Application Status
                  </h3>
                  <p
                    style={{
                      position: "absolute",
                      width: 158.13,
                      height: 20,
                      left: 513.87,
                      top: 6,
                      fontFamily: "'Inter'",
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: "20px",
                      display: "flex",
                      alignItems: "center",
                      color: "#454650",
                      margin: 0
                    }}
                  >
                    Live tracking
                  </p>
                </div>

                <div
                  style={{
                    position: "absolute",
                    width: 672,
                    height: 285,
                    left: 0,
                    top: 56,
                    background: "#011554",
                    boxShadow: "inset -2px -2px 0px rgba(170, 248, 87, 0.4)",
                    borderRadius: 12
                  }}
                >
                  {/* Stepper */}
                  <div style={{ position: "absolute", width: 608, height: 87, left: 32, top: 32 }}>
                    {/* Step 1 */}
                    <div style={{ position: "absolute", width: 108.8, height: 87, left: -0.01, top: 0 }}>
                      <span style={{ position: "absolute", width: 40, height: 40, left: 34.39, top: 0, background: "#3D6A00", borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {CHECK}
                      </span>
                      <span style={{ position: "absolute", width: 64.84, height: 16, left: 21.97, top: 56, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", textAlign: "center", letterSpacing: "0.6px", color: "#FFFFFF" }}>
                        Submitted
                      </span>
                      <span style={{ position: "absolute", width: 62.02, height: 15, left: 23.39, top: 72, fontFamily: "'Inter'", fontWeight: 400, fontSize: 10, lineHeight: "15px", color: "rgba(255,255,255,0.5)" }}>
                        Step 1 of 3
                      </span>
                    </div>
                    {/* Connector */}
                    <div style={{ position: "absolute", width: 108.81, height: 22, left: 124.8, top: 0 }}>
                      <div style={{ position: "absolute", width: 108.81, height: 2, left: 0, top: 20, background: "linear-gradient(90deg, rgba(61,106,0,0) 0%, #3D6A00 50%, #AAF857 100%)", borderRadius: 9999 }} />
                    </div>
                    {/* Step 2 */}
                    <div style={{ position: "absolute", width: 108.8, height: 87, left: 249.6, top: 0 }}>
                      <span style={{ position: "absolute", width: 40, height: 40, left: 34.39, top: 0, background: "#011554", border: "2px solid #AAF857", borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 14.67, height: 10, background: "#AAF857" }} />
                      </span>
                      <span style={{ position: "absolute", width: 87.47, height: 16, left: 10.65, top: 56, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", textAlign: "center", letterSpacing: "0.6px", color: "#AAF857" }}>
                        Under Review
                      </span>
                      <span style={{ position: "absolute", width: 53.52, height: 15, left: 27.64, top: 72, fontFamily: "'Inter'", fontWeight: 400, fontSize: 10, lineHeight: "15px", color: "rgba(170,248,87,0.5)" }}>
                        In progress
                      </span>
                    </div>
                    {/* Connector */}
                    <div style={{ position: "absolute", width: 108.8, height: 22, left: 374.41, top: 0 }}>
                      <div style={{ position: "absolute", width: 108.8, height: 2, left: 0, top: 20, background: "rgba(255,255,255,0.1)", borderRadius: 9999 }} />
                    </div>
                    {/* Step 3 */}
                    <div style={{ position: "absolute", width: 108.8, height: 87, left: 499.21, top: 0, opacity: 0.4 }}>
                      <span style={{ position: "absolute", width: 40, height: 40, left: 34.39, top: 0, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 14.67, height: 14, background: "#FFFFFF" }} />
                      </span>
                      <span style={{ position: "absolute", width: 61.5, height: 16, left: 23.64, top: 56, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", textAlign: "center", letterSpacing: "0.6px", color: "#FFFFFF" }}>
                        Approved
                      </span>
                      <span style={{ position: "absolute", width: 38.67, height: 15, left: 35.06, top: 72, fontFamily: "'Inter'", fontWeight: 400, fontSize: 10, lineHeight: "15px", color: "rgba(255,255,255,0.5)" }}>
                        Pending
                      </span>
                    </div>
                  </div>

                  {/* Info Card */}
                  <div
                    style={{
                      position: "absolute",
                      width: 608,
                      height: 94,
                      left: 32,
                      top: 159,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      boxSizing: "border-box"
                    }}
                  >
                    <span style={{ position: "absolute", width: 20, height: 20, left: 17, top: 17, background: "#AAF857" }} />
                    <div style={{ position: "absolute", width: 508.19, height: 60, left: 52.99, top: 17 }}>
                      <span style={{ position: "absolute", width: 173.16, height: 16, left: 0, top: 0, fontFamily: "'Inter'", fontWeight: 600, fontSize: 12, lineHeight: "16px", letterSpacing: "0.6px", textTransform: "uppercase", color: "#FFFFFF" }}>
                        Current Stage
                      </span>
                      <span style={{ position: "absolute", width: 508.19, height: 40, left: 0, top: 20, fontFamily: "'Inter'", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "rgba(255,255,255,0.7)" }}>
                        Our verification team is reviewing your submitted station documents.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Transparency Note */}
              <div
                style={{
                  position: "absolute",
                  width: 672,
                  height: 88,
                  left: 0,
                  top: 1480,
                  background: "#D4E3FF",
                  borderLeft: "4px solid #3D6A00",
                  borderRadius: 12,
                  boxSizing: "border-box"
                }}
              >
                <span style={{ position: "absolute", width: 20, height: 20, left: 28, top: 34, background: "#454650" }} />
                <p
                  style={{
                    position: "absolute",
                    width: 570.3,
                    height: 40,
                    left: 63.99,
                    top: 24,
                    margin: 0,
                    fontFamily: "'Inter'",
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#454650"
                  }}
                >
                  All disbursements are transparent. Track every naira with real-time settlement reports and auditable
                  inventory logs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "absolute", width: 1280, height: 495, left: 0, top: 1728, background: "#00010C" }}>
          <div style={{ position: "absolute", width: 1280, height: 335, left: 0, top: 80 }}>
            <div style={{ position: "absolute", width: 1152, height: 222, left: 64, top: 0 }}>
              <div style={{ position: "absolute", width: 432, height: 222, left: 0, top: 0 }}>
                <a href="/" aria-label="Obligon home" style={{ position: "absolute", width: 60.05, height: 40, left: 0, top: 0 }}>
                  <Image src={assets.obligonLogo} width={60} height={40} alt="Obligon" style={{ objectFit: "contain" }} />
                </a>
                <p
                  style={{
                    position: "absolute",
                    width: 360.3,
                    height: 78,
                    left: 0,
                    top: 72,
                    margin: 0,
                    fontFamily: "'Inter'",
                    fontWeight: 400,
                    fontSize: 16,
                    lineHeight: "26px",
                    color: "rgba(255,255,255,0.6)"
                  }}
                >
                  Obligon Limited is a Nigerian-based energy and technology firm committed to efficiency, transparency, and
                  innovation.
                </p>
                <div style={{ position: "absolute", width: 432, height: 40, left: 0, top: 182, display: "flex", gap: 16 }}>
                  <span style={{ width: 40, height: 40, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9999, boxSizing: "border-box" }} />
                  <span style={{ width: 40, height: 40, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9999, boxSizing: "border-box" }} />
                </div>
              </div>

              <FooterColumn title="Company" links={["About Us", "Our Mission", "Partners", "Contact"]} left={480} />
              <FooterColumn title="Product" links={["FuelVista Card", "Pricing Plans", "API Docs", "Enterprise"]} left={720} />
              <FooterColumn title="Legal" links={["Privacy Policy", "Terms of Use", "Compliance"]} left={960} />
            </div>

            <div style={{ position: "absolute", width: 1152, height: 49, left: 64, top: 286, borderTop: "1px solid rgba(255,255,255,0.05)", boxSizing: "border-box" }}>
              <span
                style={{
                  position: "absolute",
                  width: 508.63,
                  height: 16,
                  left: 321.69,
                  top: 33,
                  fontFamily: "'Inter'",
                  fontWeight: 400,
                  fontSize: 12,
                  lineHeight: "16px",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.4)"
                }}
              >
                &copy; 2024 Obligon Limited. Registered in the Federal Republic of Nigeria. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterColumn({ title, links, left }: { title: string; links: string[]; left: number }) {
  return (
    <div style={{ position: "absolute", width: 192, height: 222, left, top: 0 }}>
      <h4
        style={{
          position: "absolute",
          width: 192,
          height: 16,
          left: 0,
          top: 0,
          fontFamily: "'Inter'",
          fontWeight: 400,
          fontSize: 12,
          lineHeight: "16px",
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "#AAF857",
          margin: 0
        }}
      >
        {title}
      </h4>
      <ul style={{ position: "absolute", width: 192, height: links.length > 3 ? 128 : 92, left: 0, top: 40, margin: 0, padding: 0, listStyle: "none" }}>
        {links.map((link, index) => (
          <li key={link} style={{ position: "absolute", width: 192, height: 20, left: 0, top: index * 36 }}>
            <a href="#contact" style={{ fontFamily: "'Inter'", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
