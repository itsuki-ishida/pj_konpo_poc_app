"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import type { Dataset } from "@/types/database"
import {
  Database,
  ClipboardList,
  Settings,
  Menu,
  X,
  Upload,
  Users,
  BarChart3,
} from "lucide-react"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [datasets, setDatasets] = React.useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = React.useState<string>("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    fetchDatasets()
  }, [])

  React.useEffect(() => {
    // Load selected dataset from localStorage
    const saved = localStorage.getItem("selectedDataset")
    if (saved && datasets.some((d) => d.id === saved)) {
      setSelectedDataset(saved)
    } else if (datasets.length > 0) {
      setSelectedDataset(datasets[0].id)
      localStorage.setItem("selectedDataset", datasets[0].id)
    }
  }, [datasets])

  const fetchDatasets = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setDatasets(data || [])
    } catch (error) {
      console.error("Error fetching datasets:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDatasetChange = (value: string) => {
    setSelectedDataset(value)
    localStorage.setItem("selectedDataset", value)
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent("datasetChanged", { detail: value }))
  }

  const navItems = [
    {
      href: "/",
      label: "データ登録",
      icon: Upload,
    },
    {
      href: "/worker",
      label: "作業者画面",
      icon: ClipboardList,
    },
    {
      href: "/admin",
      label: "管理者画面",
      icon: BarChart3,
    },
  ]

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed left-4 top-4 z-50 md:hidden rounded-md p-2 bg-primary text-primary-foreground shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 z-40 h-screen w-64 transform transition-transform duration-200 ease-in-out bg-card border-r",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-6 w-6 text-primary" />
              <h1 className="font-bold text-lg">検証データ管理</h1>
            </div>

            {/* Dataset selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                検証データセット
              </label>
              <Select
                value={selectedDataset}
                onValueChange={handleDatasetChange}
                disabled={isLoading || datasets.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="データセットを選択" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {datasets.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground">
                  データセットがありません
                </p>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              検証データ管理システム v1.0
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
