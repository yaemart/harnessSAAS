import { CampaignDashboard } from '../../components/campaign-dashboard';
import { RoleGuard } from '../../components/guards/role-guard';

export default function CampaignsPage() {
    return (
        <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
            <CampaignDashboard />
        </RoleGuard>
    );
}
