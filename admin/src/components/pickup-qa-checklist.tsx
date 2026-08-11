import { Checkbox, Typography } from "antd";
import {
  PICKUP_QA_CHECKLIST_ITEMS,
  PICKUP_QA_SIGN_OFF_KEY,
  type PickupQaChecklistState,
} from "@/constants/pickup-qa-checklist";
import { SignaturePad } from "@/components/signature-pad";
import {
  extractSignatureData,
  SignaturePreview,
} from "@/components/signature-preview";

const { Text } = Typography;

interface Props {
  value: PickupQaChecklistState;
  onChange: (next: PickupQaChecklistState) => void;
  signatureData?: string | null;
  onSignatureChange?: (signatureData: string | null) => void;
  disabled?: boolean;
  /** When true, show read-only pass/fail from stored results. */
  readOnlyResults?: Record<
    string,
    { pass?: boolean; signatureData?: string } | boolean
  > | null;
  signatureResetKey?: number | string;
  /** e.g. "Supplier digital signature" when viewing admin read-only. */
  signOffLabel?: string;
}

export function PickupQaChecklistForm({
  value,
  onChange,
  signatureData,
  onSignatureChange,
  disabled,
  readOnlyResults,
  signatureResetKey,
  signOffLabel,
}: Props) {
  const isReadOnly = Boolean(readOnlyResults);
  const checkboxItems = PICKUP_QA_CHECKLIST_ITEMS.filter(
    (i) => !i.requiresSignature,
  );

  return (
    <div>
      <Text strong style={{ display: "block", marginBottom: 4 }}>
        Pickup QA Checklist
      </Text>
      <Text
        type="secondary"
        style={{ display: "block", marginBottom: 12, fontSize: 12 }}
      >
        Physical quality gate before handoff / pickup. All lines must pass,
        including a drawn digital signature.
      </Text>
      <div
        style={{
          border: "1px solid #2E2E2E",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 2fr 72px",
            gap: 8,
            padding: "8px 12px",
            background: "#1A1A1A",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#A0A0A0",
          }}
        >
          <span>Check</span>
          <span>What to verify</span>
          <span style={{ textAlign: "center" }}>Pass?</span>
        </div>
        {checkboxItems.map((item, index) => {
          const stored = readOnlyResults?.[item.key];
          const passed =
            typeof stored === "boolean"
              ? stored
              : stored && typeof stored === "object"
                ? Boolean(stored.pass)
                : value[item.key] === true;

          return (
            <div
              key={item.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 2fr 72px",
                gap: 8,
                padding: "10px 12px",
                background: index % 2 === 0 ? "#141414" : "#181818",
                borderTop: "1px solid #2E2E2E",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.whatToVerify}
              </Text>
              <div style={{ textAlign: "center" }}>
                {isReadOnly ? (
                  <Text
                    style={{
                      color: passed ? "#34d399" : "#f87171",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {passed ? "PASS" : "FAIL"}
                  </Text>
                ) : (
                  <Checkbox
                    checked={value[item.key] === true}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({ ...value, [item.key]: e.target.checked })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        {isReadOnly ? (
          (() => {
            const stored = readOnlyResults?.[PICKUP_QA_SIGN_OFF_KEY];
            const passed =
              typeof stored === "boolean"
                ? stored
                : stored && typeof stored === "object"
                  ? Boolean(stored.pass)
                  : false;
            const sig = extractSignatureData(stored);
            return (
              <div>
                <Text
                  style={{
                    color: passed ? "#34d399" : "#f87171",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Digital sign-off: {passed ? "SIGNED" : "MISSING"}
                </Text>
                <SignaturePreview
                  signatureData={sig}
                  label={signOffLabel ?? "Captured digital signature"}
                  emptyText={
                    passed
                      ? "Marked signed but stroke data is missing"
                      : "No signature on file"
                  }
                />
              </div>
            );
          })()
        ) : (
          <SignaturePad
            disabled={disabled}
            resetKey={signatureResetKey}
            onChange={({ signatureData: data }) =>
              onSignatureChange?.(data)
            }
          />
        )}
        {!isReadOnly && signatureData && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Signature captured
          </Text>
        )}
      </div>
    </div>
  );
}
