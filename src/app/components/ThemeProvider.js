"use client";

import { useState, useEffect } from "react";
import styles from "./ThemeProvider.module.css";

export default function ThemeProvider() {
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") {
            return "light";
        }

        return localStorage.getItem("theme") || "light";
    });

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    };

    return (
        <button
            type="button"
            className={styles.themeToggleButton}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
        >
            {theme === "light" ? "☀️" : "🌙"}
        </button>
    );
}
