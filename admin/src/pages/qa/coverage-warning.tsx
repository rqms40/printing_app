import { Alert } from 'antd';

export function QaCoverageWarning({
  unmetCoverage,
  matchingOutcome,
}: {
  unmetCoverage?: boolean;
  matchingOutcome?: { code: string; message?: string | null } | null;
}) {
  if (!unmetCoverage && matchingOutcome?.code !== 'no_eligible_supplier') {
    return null;
  }
  return (
    <Alert
      type="warning"
      showIcon
      message="Unmet supplier coverage"
      description={
        matchingOutcome?.message ??
        'No eligible supplier currently covers this request.'
      }
    />
  );
}
