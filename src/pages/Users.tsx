import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { MessageCircle, UserCog } from 'lucide-react'
import { canManageIONUsers } from '../lib/permissions'
import { useAuth } from '../context/AuthContext'

export default function UsersPage() {
  const { user } = useAuth()
  const canManage = canManageIONUsers(user?.role_name)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">ION App Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all ION app end-users and customer support</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-5 w-5" />
            User Management
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            List and manage ION app customers: view sessions, balance, support history. {canManage ? 'Edit roles and access when API is connected.' : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span>ION app user list and customer support tools will load from your backend (e.g. user management and support ticket assignment).</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">Customer Support</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Handle support requests from app users: refunds, session issues, account questions. Link to support tickets and user profile.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Customer support queue and actions will be available when integrated with your support or CRM API.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
