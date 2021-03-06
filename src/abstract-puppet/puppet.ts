/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import { EventEmitter } from 'events'

import { StateSwitch }  from 'state-switch'
import {
  Watchdog,
  WatchdogFood,
}                       from 'watchdog'
import {
  Constructor,
}                       from 'clone-class'

import { Wechaty }      from '../wechaty'

import {
  Sayable,
  WechatyEvent,
  log,
}                       from '../config'
import Profile          from '../profile'

import {
  Contact,
  ContactQueryFilter,
}                       from './contact'
import FriendRequest    from './friend-request'
import Message          from './message'

import {
  Room,
  RoomQueryFilter,
}                       from './room'

export interface ScanData {
  avatar: string, // Image Data URL
  url:    string, // QR Code URL
  code:   number, // Code
}

export type PuppetEvent = WechatyEvent
                        | 'watchdog'

export interface PuppetOptions {
  profile: Profile,
  wechaty: Wechaty,
}

export type PuppetContactClass        = typeof Contact        & Constructor<{}>
export type PuppetFriendRequestClass  = typeof FriendRequest  & Constructor<{}>
export type PuppetMessageClass        = typeof Message        & Constructor<{}>
export type PuppetRoomClass           = typeof Room           & Constructor<{}>

export interface PuppetClasses {
  Contact:        PuppetContactClass,
  FriendRequest:  PuppetFriendRequestClass,
  Message:        PuppetMessageClass,
  Room:           PuppetRoomClass,
}

/**
 * Abstract Puppet Class
 */
export abstract class Puppet extends EventEmitter implements Sayable {
  public WATCHDOG_TIMEOUT  = 1 * 60 * 1000  // 1 minute

  public user?: Contact

  public state:     StateSwitch
  public watchdog:  Watchdog

  // tslint:disable-next-line:variable-name
  public Contact:       PuppetContactClass
  // tslint:disable-next-line:variable-name
  public FriendRequest: PuppetFriendRequestClass
  // tslint:disable-next-line:variable-name
  public Message:       PuppetMessageClass
  // tslint:disable-next-line:variable-name
  public Room:          PuppetRoomClass

  constructor(
    public options: PuppetOptions,
    classes:        PuppetClasses,
  ) {
    super()

    this.state    = new StateSwitch('Puppet', log)
    this.watchdog = new Watchdog((this.constructor as any as Puppet).WATCHDOG_TIMEOUT, 'Puppet')

    this.Contact        = classes.Contact
    this.FriendRequest  = classes.FriendRequest
    this.Message        = classes.Message
    this.Room           = classes.Room

    // https://stackoverflow.com/questions/14486110/how-to-check-if-a-javascript-class-inherits-another-without-creating-an-obj
    const check = this.Contact.prototype        instanceof Contact
                && this.FriendRequest.prototype instanceof FriendRequest
                && this.Message.prototype       instanceof Message
                && this.Room.prototype          instanceof Room

    if (!check) {
      throw new Error('Puppet must set classes right! https://github.com/Chatie/wechaty/issues/1167')
    }
  }

  public emit(event: 'error',       e: Error)                                                      : boolean
  public emit(event: 'friend',      friend: Contact, request?: FriendRequest)                      : boolean
  public emit(event: 'heartbeat',   data: any)                                                     : boolean
  public emit(event: 'login',       user: Contact)                                                 : boolean
  public emit(event: 'logout',      user: Contact | string)                                        : boolean
  public emit(event: 'message',     message: Message)                                              : boolean
  public emit(event: 'room-join',   room: Room, inviteeList: Contact[],  inviter: Contact)         : boolean
  public emit(event: 'room-leave',  room: Room, leaverList: Contact[])                             : boolean
  public emit(event: 'room-topic',  room: Room, topic: string, oldTopic: string, changer: Contact) : boolean
  public emit(event: 'scan',        url: string, code: number)                                     : boolean
  public emit(event: 'watchdog',    food: WatchdogFood)                                            : boolean
  public emit(event: never, ...args: never[])                                                      : never

  public emit(
    event:   PuppetEvent,
    ...args: any[],
  ): boolean {
    return super.emit(event, ...args)
  }

  public on(event: 'error',       listener: (e: Error) => void)                                                      : this
  public on(event: 'friend',      listener: (friend: Contact, request?: FriendRequest) => void)                      : this
  public on(event: 'heartbeat',   listener: (data: any) => void)                                                     : this
  public on(event: 'login',       listener: (user: Contact) => void)                                                 : this
  public on(event: 'logout',      listener: (user: Contact) => void)                                                 : this
  public on(event: 'message',     listener: (message: Message) => void)                                              : this
  public on(event: 'room-join',   listener: (room: Room, inviteeList: Contact[],  inviter: Contact) => void)         : this
  public on(event: 'room-leave',  listener: (room: Room, leaverList: Contact[]) => void)                             : this
  public on(event: 'room-topic',  listener: (room: Room, topic: string, oldTopic: string, changer: Contact) => void) : this
  public on(event: 'scan',        listener: (info: ScanData) => void)                                                : this
  public on(event: 'watchdog',    listener: (data: WatchdogFood) => void)                                            : this
  public on(event: never,         listener: never)                                                                   : never

  public on(
    event:    PuppetEvent,
    listener: (...args: any[]) => void,
  ): this {
    super.on(event, listener)
    return this
  }

  public abstract async start() : Promise<void>
  public abstract async stop()  : Promise<void>

  public abstract self() : Contact

  // public abstract getContact(id: string): Promise<any>

  /**
   * Message
   */
  public abstract forward(message: Message, contact: Contact | Room) : Promise<void>
  public abstract say(text: string)                                  : Promise<void>
  public abstract send(message: Message)                             : Promise<void>

  /**
   * Login / Logout
   */
  public abstract logonoff()  : boolean
  public abstract logout()    : Promise<void>

  /**
   * Misc
   */
  public abstract ding(data?: any) : Promise<string>

  /**
   * FriendRequest
   */
  public abstract friendRequestSend(contact: Contact, hello?: string)   : Promise<void>
  public abstract friendRequestAccept(contact: Contact, ticket: string) : Promise<void>

  /**
   * Room
   */
  public abstract roomAdd(room: Room, contact: Contact)              : Promise<void>
  public abstract roomCreate(contactList: Contact[], topic?: string) : Promise<Room>
  public abstract roomDel(room: Room, contact: Contact)              : Promise<void>
  public abstract roomFindAll(filter: RoomQueryFilter)           : Promise<Room[]>
  public abstract roomTopic(room: Room, topic?: string)              : Promise<string | void>

  /**
   * Contact
   */
  public abstract contactAlias(contact: Contact)                      : Promise<string>
  public abstract contactAlias(contact: Contact, alias: string | null): Promise<void>
  public abstract contactAlias(contact: Contact, alias?: string|null) : Promise<string | void>

  public abstract contactFindAll(filter: ContactQueryFilter)          : Promise<Contact[]>
}

// export class WechatError extends Error {
//   public code: WechatErrorCode
// }

export default Puppet
