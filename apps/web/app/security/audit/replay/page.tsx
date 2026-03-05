import { ReplayAuditDashboard } from '../../../../components/replay-audit-dashboard';
import { RoleGuard } from '../../../../components/guards/role-guard';

export default function ReplayAuditPage() {
  return (
    <RoleGuard allowedRoles={['system_admin']}>
      <ReplayAuditDashboard />
    </RoleGuard>
  );
}
