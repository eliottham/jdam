import Session from './session'

export interface Friend {
  id: string,
  nickmame: string,
  pending: boolean,
  requested: Date,
  added?: Date
}

export interface AccountParams {
  id?: string
  email?: string
  nickname?: string
  avatarId?: string
  settings?: Record<string, unknown> | null | undefined
  friends?: []
}

class Account {
  id = ''
  email = ''
  nickname = ''
  avatarId = ''
  settings = {}
  sessions = new Map<string, Session>()
  friends: Friend[] = []

  constructor({ 
    id = '',
    email = '',
    nickname = '',
    avatarId = '',
    settings = {},
    friends = []
  }: AccountParams) {
    Object.assign(this, {
      id,
      email,
      nickname,
      avatarId,
      settings,
      friends
    })
  }

  isFriend(accountId: string) {
    return !!this.friends.find(friend => friend.id === accountId)
  }

  getFriends() {
    return this.friends
  }
}

export default Account
