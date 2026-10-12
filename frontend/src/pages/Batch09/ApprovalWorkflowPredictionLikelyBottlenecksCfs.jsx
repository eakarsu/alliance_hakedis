import LegacyAiPrompt from '../../components/LegacyAiPrompt';

export default function ApprovalWorkflowPredictionLikelyBottlenecksPage() {
  return <LegacyAiPrompt title={"Approval workflow prediction (likely bottlenecks)"} endpoint={"/api/custom/approval-workflow-prediction-likely-bottlenecks"} />;
}
