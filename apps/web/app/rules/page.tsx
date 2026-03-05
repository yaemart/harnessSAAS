import { RuleStudio } from '../../components/rule-studio';
import { RoleGuard } from '../../components/guards/role-guard';

export default function RulesPage() {
  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
      <RuleStudio />
    </RoleGuard>
  );
}
