package com.natasshka.messenger

import android.content.Intent
import android.content.Context
import android.net.Uri
import android.text.Spannable
import android.text.SpannableString
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.text.util.Linkify
import android.view.View
import android.widget.TextView
import java.util.regex.Pattern

class LinkParser(private val context: Context) {
    companion object {
        private val EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9\\+\\.\\_\\%\\-\\+]{1,256}\\@" +
                    "[a-zA-Z0-9][a-zA-Z0-9\\-]{0,64}(\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,25})+"
        )
        private val PHONE_PATTERN = Pattern.compile(
            "(\\+7|8)?[\\s\\-\\(\\)]*\\d{3}[\\s\\-\\(\\)]*\\d{3}[\\s\\-\\(\\)]*\\d{2}[\\s\\-\\(\\)]*\\d{2}"
        )
    }
    fun parseAndSetLinks(textView: TextView, text: String, isEncrypted: Boolean = false) {
        if (text.isEmpty()) return
        if (isEncrypted && (text.contains("🔒") || text.contains("Неверный ключ"))) {
            textView.text = text
            textView.movementMethod = LinkMovementMethod.getInstance()
            return
        }
        val spannableText = SpannableString(text)
        Linkify.addLinks(spannableText, Linkify.WEB_URLS)
        Linkify.addLinks(spannableText, EMAIL_PATTERN, "mailto:")
        Linkify.addLinks(spannableText, PHONE_PATTERN, "tel:")
        textView.text = spannableText
        textView.movementMethod = LinkMovementMethod.getInstance()
        textView.setLinkTextColor(context.getColor(android.R.color.holo_blue_dark))
    }
    fun containsLinks(text: String): Boolean {
        if (text.isEmpty()) return false
        return containsWebURLs(text) ||
                containsEmail(text) ||
                containsPhone(text)
    }
    private fun containsWebURLs(text: String): Boolean {
        val patterns = arrayOf(
            Pattern.compile("https?://\\S+"),
            Pattern.compile("ftp://\\S+"),
            Pattern.compile("www\\.\\S+")
        )
        return patterns.any { pattern ->
            pattern.matcher(text).find()
        }
    }
    private fun containsEmail(text: String): Boolean {
        return EMAIL_PATTERN.matcher(text).find()
    }
    private fun containsPhone(text: String): Boolean {
        return PHONE_PATTERN.matcher(text).find()
    }
    fun extractLinks(text: String): List<String> {
        val links = mutableListOf<String>()
        val urlPatterns = listOf(
            "https?://[^\\s]+",
            "ftp://[^\\s]+",
            "www\\.[^\\s]+"
        )
        urlPatterns.forEach { patternStr ->
            val pattern = Pattern.compile(patternStr)
            val matcher = pattern.matcher(text)
            while (matcher.find()) {
                links.add(matcher.group())
            }
        }
        val emailMatcher = EMAIL_PATTERN.matcher(text)
        while (emailMatcher.find()) {
            links.add("mailto:${emailMatcher.group()}")
        }
        val phoneMatcher = PHONE_PATTERN.matcher(text)
        while (phoneMatcher.find()) {
            val phone = phoneMatcher.group().replace(Regex("[\\s\\-\\(\\)]"), "")
            links.add("tel:$phone")
        }
        return links
    }
    fun parseWithCustomClickHandlers(textView: TextView, text: String) {
        val spannable = SpannableString(text)
        Linkify.addLinks(spannable, Linkify.WEB_URLS)
        val emailMatcher = EMAIL_PATTERN.matcher(text)
        while (emailMatcher.find()) {
            val start = emailMatcher.start()
            val end = emailMatcher.end()
            val email = text.substring(start, end)
            spannable.setSpan(
                object : ClickableSpan() {
                    override fun onClick(widget: View) {
                        val intent = Intent(Intent.ACTION_SENDTO).apply {
                            data = Uri.parse("mailto:$email")
                        }
                        if (intent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(intent)
                        }
                    }
                },
                start,
                end,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        val phoneMatcher = PHONE_PATTERN.matcher(text)
        while (phoneMatcher.find()) {
            val start = phoneMatcher.start()
            val end = phoneMatcher.end()
            val phone = text.substring(start, end).replace(Regex("[\\s\\-\\(\\)]"), "")
            spannable.setSpan(
                object : ClickableSpan() {
                    override fun onClick(widget: View) {
                        val intent = Intent(Intent.ACTION_DIAL).apply {
                            data = Uri.parse("tel:$phone")
                        }
                        if (intent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(intent)
                        }
                    }
                },
                start,
                end,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        textView.text = spannable
        textView.movementMethod = LinkMovementMethod.getInstance()
        textView.setLinkTextColor(context.getColor(android.R.color.holo_blue_dark))
    }
    fun hasWebLinks(text: String): Boolean {
        val urlPatterns = arrayOf(
            "https?://",
            "ftp://",
            "www\\."
        )
        return urlPatterns.any { text.contains(it, ignoreCase = true) }
    }
    fun highlightLinks(text: String): SpannableString {
        val spannable = SpannableString(text)
        Linkify.addLinks(spannable, Linkify.WEB_URLS or Linkify.EMAIL_ADDRESSES or Linkify.PHONE_NUMBERS)
        return spannable
    }
}