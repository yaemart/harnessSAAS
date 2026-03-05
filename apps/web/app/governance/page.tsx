import { GovernanceDashboard } from '../../components/governance-dashboard';
import { RoleGuard } from '../../components/guards/role-guard';

export default function GovernancePage() {
    return (
        <RoleGuard allowedRoles={['tenant_admin']}>
            <GovernanceDashboard />
        </RoleGuard>
    );
}
