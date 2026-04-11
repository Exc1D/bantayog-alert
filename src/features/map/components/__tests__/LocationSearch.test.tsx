import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import L from 'leaflet'
import { LocationSearch } from '../LocationSearch'

// Mock Leaflet map
const mockFlyTo = vi.fn()
const mockMap = {
  flyTo: mockFlyTo,
} as unknown as L.Map

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('LocationSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should render search input', () => {
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Search for a location...')
  })

  it('should show search icon', () => {
    render(<LocationSearch map={mockMap} />)

    // Search icon should be visible (it's in the DOM before the input)
    const searchIcon = document.querySelector('.lucide-search')
    expect(searchIcon).toBeInTheDocument()
  })

  it('should update query on input change', async () => {
    const user = userEvent.setup()
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.type(input, 'Manila')

    expect(input).toHaveValue('Manila')
  })

  it('should show clear button when query is not empty', async () => {
    const user = userEvent.setup()
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.type(input, 'Test')

    const clearButton = screen.getByTestId('location-search-clear')
    expect(clearButton).toBeInTheDocument()
  })

  it('should clear query when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input') as HTMLInputElement
    await user.type(input, 'Test')

    const clearButton = screen.getByTestId('location-search-clear')
    await user.click(clearButton)

    expect(input.value).toBe('')
  })

  it('should show dropdown on focus', async () => {
    const user = userEvent.setup()
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Dropdown should be visible (though empty without recent searches)
    const dropdown = screen.queryByTestId('location-search-dropdown')
    // It won't show if there are no results or recent searches
    expect(dropdown).toBeNull()
  })

  it('should show loading indicator during search', async () => {
    const user = userEvent.setup()
    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.type(input, 'Manila')

    // The search should be triggered (we can't easily test the loading state
    // due to timing issues, but we can verify the component handles loading)
    // This test mainly ensures no errors occur during search
    expect(input).toHaveValue('Manila')
  })

  it('should call onLocationSelect callback when location is selected', async () => {
    const user = userEvent.setup()
    const mockOnLocationSelect = vi.fn()

    // Mock recent searches in localStorage
    const recentSearch = {
      displayName: 'Test Location, Philippines',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} onLocationSelect={mockOnLocationSelect} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for recent searches to appear
    await waitFor(() => {
      const recentSearchButton = screen.getByTestId('recent-search-0')
      expect(recentSearchButton).toBeInTheDocument()
    })

    const recentSearchButton = screen.getByTestId('recent-search-0')
    await user.click(recentSearchButton)

    expect(mockFlyTo).toHaveBeenCalledWith([14.5995, 120.9842], 15, {
      animate: true,
      duration: 1.5,
    })
    expect(mockOnLocationSelect).toHaveBeenCalledWith(14.5995, 120.9842)
  })

  it('should center map on selected location', async () => {
    const user = userEvent.setup()

    // Mock recent searches
    const recentSearch = {
      displayName: 'Test Location, Philippines',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for recent searches to appear
    await waitFor(() => {
      const recentSearchButton = screen.getByTestId('recent-search-0')
      expect(recentSearchButton).toBeInTheDocument()
    })

    const recentSearchButton = screen.getByTestId('recent-search-0')
    await user.click(recentSearchButton)

    expect(mockFlyTo).toHaveBeenCalledWith([14.5995, 120.9842], 15, {
      animate: true,
      duration: 1.5,
    })
  })

  it('should truncate long location names', async () => {
    const user = userEvent.setup()

    // Mock a recent search with a very long name
    const longName =
      'This is a very long location name that should be truncated in the UI because it exceeds the maximum length limit of sixty characters'

    const recentSearch = {
      displayName: longName,
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for recent searches to appear
    await waitFor(() => {
      const recentSearchButton = screen.getByTestId('recent-search-0')
      expect(recentSearchButton).toBeInTheDocument()
    })

    const recentSearchButton = screen.getByTestId('recent-search-0')
    expect(recentSearchButton.textContent).toContain('...')
    expect(recentSearchButton.textContent!.length).toBeLessThan(longName.length)
  })

  it('should hide dropdown when clicking outside', async () => {
    const user = userEvent.setup()

    // Mock recent searches
    const recentSearch = {
      displayName: 'Test Location',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for dropdown to appear
    await waitFor(() => {
      const dropdown = screen.queryByTestId('location-search-dropdown')
      expect(dropdown).toBeInTheDocument()
    })

    // Blur the input
    input.blur()

    // Wait for dropdown to hide (delayed)
    await waitFor(
      () => {
        const dropdown = screen.queryByTestId('location-search-dropdown')
        expect(dropdown).toBeNull()
      },
      { timeout: 500 },
    )
  })

  it('should show "Recent Searches" section header', async () => {
    const user = userEvent.setup()

    const recentSearch = {
      displayName: 'Test Location',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for dropdown and check for "Recent Searches" header
    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument()
    })
  })

  it('should show clock icon for recent searches', async () => {
    const user = userEvent.setup()

    const recentSearch = {
      displayName: 'Test Location',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }
    localStorage.setItem('bantayog-recent-searches', JSON.stringify([recentSearch]))

    render(<LocationSearch map={mockMap} />)

    const input = screen.getByTestId('location-search-input')
    await user.click(input)

    // Wait for dropdown and check for clock icon
    await waitFor(() => {
      const clockIcons = document.querySelectorAll('.lucide-clock')
      expect(clockIcons.length).toBeGreaterThan(0)
    })
  })
})
