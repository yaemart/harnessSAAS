import { AppearanceDashboard } from '../../components/appearance-dashboard';
import { RoleGuard } from '../../components/guards/role-guard';

export default function AppearancePage() {
    return (
        <RoleGuard allowedRoles={['system_admin', 'tenant_admin', 'operator']}>
            <AppearanceDashboard />
        </RoleGuard>
    );
}
