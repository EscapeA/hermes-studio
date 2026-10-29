import { describe, expect, it } from 'vitest'

import { partitionRecentSessions } from '../../packages/client/src/components/hermes/chat/session-category-groups'

describe('recent session partition', () => {
  it('orders by strict activity time and splits the newest page from the rest', () => {
    const sessions = [
      { id: 'older', updatedAt: 100 },
      { id: 'newest', updatedAt: 300 },
      { id: 'middle', updatedAt: 200 },
    ]

    const partition = partitionRecentSessions(sessions, 2, 'Recent')

    expect(partition.group).toEqual({
      key: 'recent',
      label: 'Recent',
      sessions: [sessions[1], sessions[2]],
    })
    expect(partition.remaining.map(session => session.id)).toEqual(['older'])
    // The source list must never be reordered in place.
    expect(sessions.map(session => session.id)).toEqual(['older', 'newest', 'middle'])
  })

  it('grows the visible window by page size so "load more" appends older sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, index) => ({
      id: `session-${index}`,
      updatedAt: 1000 - index,
    }))

    expect(partitionRecentSessions(sessions, 2, 'Recent').group.sessions.map(s => s.id))
      .toEqual(['session-0', 'session-1'])
    expect(partitionRecentSessions(sessions, 4, 'Recent').group.sessions.map(s => s.id))
      .toEqual(['session-0', 'session-1', 'session-2', 'session-3'])
    expect(partitionRecentSessions(sessions, 6, 'Recent').remaining).toEqual([])
  })

  it('clamps the limit to a sane page size', () => {
    const sessions = [{ id: 'only', updatedAt: 1 }]

    expect(partitionRecentSessions(sessions, 0, 'Recent').group.sessions).toHaveLength(1)
    expect(partitionRecentSessions(sessions, Number.NaN, 'Recent').group.sessions).toHaveLength(1)
    expect(partitionRecentSessions(sessions, 5000, 'Recent').group.sessions).toHaveLength(1)
  })
})
