import { RoleGuard } from '../../components/guards/role-guard';
import { MappingReviewDashboard } from '../../components/mapping-review-dashboard';

export default function MappingReviewPage() {
  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
      <MappingReviewDashboard />
    </RoleGuard>
  );
}

