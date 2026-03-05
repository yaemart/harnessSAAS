import { AssetsDashboard } from '../../components/assets-dashboard';
import { RoleGuard } from '../../components/guards/role-guard';

export default function AssetsPage() {
    return (
        <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
            <AssetsDashboard />
        </RoleGuard>
    );
}
