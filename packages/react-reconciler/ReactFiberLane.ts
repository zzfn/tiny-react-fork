import { FiberRoot } from './ReactInternalTypes'

export const TotalLanes = 31

export type Lanes = number
export type Lane = number
export type LaneMap<T> = Array<T>

export const NoLanes: Lane = /*                          */ 0b0000000000000000000000000000000
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001
export const InputContinuousLane: Lanes = /*            */ 0b0000000000000000000000000000100
export const DefaultLane: Lanes = /*                    */ 0b0000000000000000000000000010000

export const IdleLane: Lanes = /*                       */ 0b0100000000000000000000000000000

const NonIdleLanes = /*                                 */ 0b0001111111111111111111111111111

export const NoTimestamp = -1

const clz32 = Math.clz32

const pickArbitraryLaneIndex = (lanes: Lanes): number => {
  return 31 - clz32(lanes)
}

/**
 * 根据任务的优先级为其计算一个过期时间
 * @param lane 优先级
 * @param currentTime 当前的时间 
 * @returns 
 */
const computeExpirationTime = (lane: Lane, currentTime: number): number => {
  switch (lane) {
    case SyncLane:
      return currentTime + 250
    case DefaultLane:
      return currentTime + 5000
    default: {
      throw new Error('Not Implement')
    }
  }
}

/**
 * 将已经过期的任务标记出来
 * @param root FiberRoot
 * @param currentTime 当前的时间
 */
export const markStarvedLanesAsExpired = (
  root: FiberRoot,
  currentTime: number
): void => {
  const pendingLanes = root.pendingLanes
  const expirationTimes = root.expirationTimes

  let lanes = pendingLanes

  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes)
    const lane = 1 << index

    const expirationTime = expirationTimes[index]

    if (expirationTime === NoTimestamp) {
      /**
       * 还没有相关的时间戳，帮他计算一个
       */
      expirationTimes[index] = computeExpirationTime(lane, currentTime)
    } else if (expirationTime <= currentTime) {
      //已经过期将其加入到expiredLanes中
      root.expiredLanes |= lane
    }

    //从lanes中移除该lane，下一轮循环就能开始检测下一个lane了
    lanes &= ~lane
  }
}

/**
 * 获得一个数中以最低位1所形成的数字，原理可以去查看负数的表示
 * 比如输入 0b111 就返回 0b001
 * 0b101 -> 0b001
 * 0b100 -> 0b100
 * 0b1000001000 -> 0b0000001000
 * 0b1111111110 -> 0b0000000010
 * @param lanes 
 * @returns 
 */
export const getHighestPriorityLane = (lanes: Lanes): Lane => {
  return lanes & -lanes
}

/**
 * 返回现有的lanes中最高优先级的lane
 * @param lanes 
 * @returns 
 */
const getHighestPriorityLanes = (lanes: Lanes | Lane): Lanes => {
  switch (getHighestPriorityLane(lanes)) {
    case SyncLane:
      return SyncLane
    case DefaultLane:
      return DefaultLane
    default: {
      throw new Error('Not Implement')
    }
  }
}

/**
 * 根据当前root的pendingLanes和workInProgressLanes返回这次更新的lanes
 * @param root
 * @param wipLanes
 * @returns
 */
export const getNextLanes = (root: FiberRoot, wipLanes: Lanes): Lanes => {
  const pendingLanes = root.pendingLanes

  //提前退出，如果没有待进行的工作
  if (pendingLanes === NoLanes) return NoLanes

  let nextLanes = NoLanes

  const nonIdlePendingLanes = pendingLanes & NonIdleLanes

  //存在lanes被占用，找出哪个最高优先级的
  if (nonIdlePendingLanes !== NoLanes) {
    //返回现被占用的lanes中最高优先级的lane
    nextLanes = getHighestPriorityLanes(nonIdlePendingLanes)
  } else {
    throw new Error('Not Implement')
  }

  if (nextLanes === NoLanes) {
    return NoLanes
  }

  /**
   * 如果已经处于render阶段，切换lanes会导致丢失进度
   * 我们只应该在新的lane拥有更高的优先级的时候这样做
   */
  if (wipLanes !== NoLanes && wipLanes !== nextLanes) {
    const nextLane = getHighestPriorityLane(nextLanes)
    const wipLane = getHighestPriorityLane(wipLanes)

    //如果该次任务的优先级低于现存任务的优先级则workInProgressLanes不变
    if (nextLane >= wipLane) {
      return wipLanes
    }
  }

  return nextLanes
}

export const includesSomeLane = (a: Lanes | Lane, b: Lanes | Lane): boolean => {
  return (a & b) !== NoLanes
}

export const mergeLanes = (a: Lanes | Lane, b: Lanes | Lane): Lanes => {
  return a | b
}

const laneToIndex = (lane: Lane): number => {
  return pickArbitraryLaneIndex(lane)
}

/**
 * 把该次更新的lane并到root的pendingLanes中，以及记录该更新对应lane的发生的时间，
 * 方便以后可以判断该更新是否已经过期需要立即执行该更新
 * @param root FiberRoot
 * @param updateLane 该更新对应的lane
 * @param eventTime 该更新发生的时间
 */
export const markRootUpdated = (
  root: FiberRoot,
  updateLane: Lane,
  eventTime: number
): void => {
  //root上包含的更新他们所对应的lanes
  root.pendingLanes |= updateLane

  //一个三十一位的数组，分别对应着31位lane
  const eventTimes = root.eventTimes

  const index = laneToIndex(updateLane)
  eventTimes[index] = eventTime
}

export const createLaneMap = <T>(initial: T): LaneMap<T> => {
  const laneMap = []
  for (let i = 0; i < TotalLanes; ++i) {
    laneMap.push(initial)
  }

  return laneMap
}

export const isSubsetOfLanes = (set: Lanes, subset: Lanes | Lane) => {
  return (set & subset) === subset
}

export const includesNonIdleWork = (lanes: Lanes): boolean => {
  return (lanes & NonIdleLanes) !== NonIdleLanes
}

const enableSyncDefaultUpdates = false

export const shouldTimeSlice = (root: FiberRoot, lanes: Lanes): boolean => {
  if ((lanes & root.expiredLanes) !== NoLanes) {
    //至少有一个lane已经过期了，为了防止更多的lane过期
    //因该尽快完成渲染，而不把控制权交给浏览器
    return false
  }

  if (enableSyncDefaultUpdates) {
    const SyncDefaultLanes = InputContinuousLane | DefaultLane

    return (lanes & SyncDefaultLanes) === NoLanes
  } else {
    return true
  }
}

export const markRootFinished = (root: FiberRoot, remainingLanes: Lanes) => {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes

  root.pendingLanes = remainingLanes
  root.expiredLanes &= remainingLanes

  const eventTimes = root.eventTimes
  const expirationTimes = root.expirationTimes

  let lanes = noLongerPendingLanes

  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes)
    const lane = 1 << index
    eventTimes[index] = NoTimestamp
    expirationTimes[index] = NoTimestamp
    lanes &= ~lane
  }
}

export const removeLanes = (set: Lanes, subset: Lanes | Lane): Lanes => {
  return set & ~subset
}
