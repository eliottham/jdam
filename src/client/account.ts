import Session from './session'

export interface Friend {
  _id: string,
  nickmame: string,
  pending: boolean,
  requested: Date,
  added?: Date
}

interface AccountParams {
  _id: string
  email: string
  nickname: string
  avatarId?: string
  settings?: Record<string, unknown> | null | undefined
  sessions?: Session[]
  friends?: []
}

export class Account {
  _id = ''
  email = ''
  nickname = ''
  avatarId = ''
  settings = {}
  sessions: Session[] = []
  friends: Friend[] = []

  constructor({ _id, email, nickname, avatarId, settings, sessions, friends }: AccountParams) {
    this._id = _id
    this.email = email
    this.nickname = nickname
    this.avatarId = avatarId || ''
    this.settings = settings || {}
    this.sessions = sessions || []
    this.friends = friends || []
  }

  isFriend(accountId: string) {
    return !!this.friends.find(friend => friend._id === accountId)
  }

  getFriends() {
    return this.friends
  }
}

export default Account