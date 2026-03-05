import { ApprovalsDashboard } from '../../components/approvals-dashboard';
import { RoleGuard } from '../../components/guards/role-guard';

export default function ApprovalsPage() {
  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
      <ApprovalsDashboard />
    </RoleGuard>
  );
}
