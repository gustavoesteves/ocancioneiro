import QtQuick 2.15
import QtQuick.Controls 2.15
import MuseScore 3.0

MuseScore {
    menuPath: "Plugins.O Cancioneiro.Capturar MusicXML"
    title: "O Cancioneiro — Captura MusicXML"
    description: "Exporta a partitura ativa para a ponte local do Cancioneiro."
    version: "1.0.0"
    requiresScore: false
    pluginType: "dialog"

    width: 420
    height: 300

    property string protocol: "cancioneiro.musescore.capture/1"
    property string bridgeBaseUrl: "http://127.0.0.1:47631"
    property string sessionId: ""
    property string pluginSessionId: ""
    property string pluginToken: ""
    property string connectionState: "ponte ausente"
    property string activeRequestId: ""
    property string lastScoreLabel: "Nenhuma captura enviada"
    property bool requestInFlight: false
    property bool exportInProgress: false
    property int messageSequence: 0

    function nowIso() {
        return new Date().toISOString()
    }

    function messageId(type) {
        messageSequence += 1
        return "plugin_" + type.toLowerCase() + "_" + Date.now() + "_" + messageSequence
    }

    function scoreLabel() {
        if (!curScore)
            return "Nenhuma partitura ativa"
        if (curScore.scoreName && curScore.scoreName.length > 0)
            return curScore.scoreName
        return "Partitura ativa sem titulo"
    }

    function clearSession() {
        sessionId = ""
        pluginSessionId = ""
        pluginToken = ""
        activeRequestId = ""
        requestInFlight = false
        exportInProgress = false
    }

    function headers(request) {
        request.setRequestHeader("Content-Type", "application/json")
        request.setRequestHeader("X-Cancioneiro-Plugin-Token", pluginToken)
        request.setRequestHeader("X-Cancioneiro-Plugin-Session", pluginSessionId)
    }

    function envelope(type, payload) {
        return {
            protocol: protocol,
            messageType: type,
            messageId: messageId(type),
            sentAt: nowIso(),
            payload: payload
        }
    }

    function postMessage(type, payload, callback) {
        var request = new XMLHttpRequest()
        request.onreadystatechange = function() {
            if (request.readyState !== XMLHttpRequest.DONE)
                return

            if (request.status === 401 || request.status === 409) {
                clearSession()
                connectionState = "ponte ausente"
            }
            if (callback)
                callback(request.status)
        }

        try {
            request.open("POST", bridgeBaseUrl + "/api/v1/plugin/messages", true)
            headers(request)
            request.send(JSON.stringify(envelope(type, payload)))
        } catch (error) {
            clearSession()
            connectionState = "ponte ausente"
            if (callback)
                callback(0)
        }
    }

    function openSession() {
        if (requestInFlight)
            return
        requestInFlight = true
        var request = new XMLHttpRequest()
        request.onreadystatechange = function() {
            if (request.readyState !== XMLHttpRequest.DONE)
                return
            requestInFlight = false

            if (request.status !== 200) {
                clearSession()
                connectionState = "ponte ausente"
                return
            }

            try {
                var session = JSON.parse(request.responseText)
                if (session.protocol !== protocol)
                    throw new Error("Protocolo incompativel")
                sessionId = session.sessionId || ""
                pluginSessionId = session.pluginSessionId || ""
                pluginToken = session.pluginToken || ""
                if (!sessionId || !pluginSessionId || !pluginToken)
                    throw new Error("Sessao incompleta")

                postMessage("SESSION_OPEN", {
                    sessionId: sessionId,
                    pluginSessionId: pluginSessionId,
                    pluginVersion: version,
                    musescoreVersion: "4.x",
                    supportedProtocols: [protocol]
                }, function(status) {
                    connectionState = status === 200 ? "pareado" : "ponte ausente"
                })
            } catch (error) {
                clearSession()
                connectionState = "falhou"
            }
        }

        try {
            request.open("GET", bridgeBaseUrl + "/api/v1/plugin-session", true)
            request.send()
        } catch (error) {
            requestInFlight = false
            clearSession()
            connectionState = "ponte ausente"
        }
    }

    function sendFailure(requestId, code, message, retryable) {
        postMessage("CAPTURE_FAILED", {
            sessionId: sessionId,
            pluginSessionId: pluginSessionId,
            requestId: requestId,
            failedAt: nowIso(),
            error: {
                code: code,
                message: message,
                retryable: retryable
            }
        }, function() {
            if (activeRequestId === requestId) {
                exportInProgress = false
                activeRequestId = ""
                connectionState = "falhou"
            }
        })
    }

    function exportCapture(message) {
        var payload = message.payload
        if (!payload || payload.sessionId !== sessionId ||
                payload.pluginSessionId !== pluginSessionId ||
                typeof payload.requestId !== "string" ||
                typeof payload.destinationPath !== "string")
            return

        if (exportInProgress) {
            if (payload.requestId !== activeRequestId)
                sendFailure(payload.requestId, "REQUEST_DUPLICATE", "Outra captura esta em andamento.", true)
            return
        }

        activeRequestId = payload.requestId
        exportInProgress = true
        connectionState = "exportando"
        lastScoreLabel = scoreLabel()

        if (!curScore) {
            sendFailure(payload.requestId, "NO_ACTIVE_SCORE", "Nenhuma partitura ativa.", true)
            return
        }

        try {
            writeScore(curScore, payload.destinationPath, "musicxml")
            postMessage("CAPTURE_READY", {
                sessionId: sessionId,
                pluginSessionId: pluginSessionId,
                requestId: payload.requestId,
                exportedAt: nowIso()
            }, function(status) {
                exportInProgress = false
                activeRequestId = ""
                connectionState = status === 200 ? "enviado" : "falhou"
            })
        } catch (error) {
            sendFailure(payload.requestId, "EXPORT_FAILED", "Nao foi possivel exportar o MusicXML.", true)
        }
    }

    function pollEvents() {
        if (!pluginToken || requestInFlight || exportInProgress) {
            if (!pluginToken && !requestInFlight)
                openSession()
            return
        }

        requestInFlight = true
        var request = new XMLHttpRequest()
        request.onreadystatechange = function() {
            if (request.readyState !== XMLHttpRequest.DONE)
                return
            requestInFlight = false

            if (request.status === 401 || request.status === 409) {
                clearSession()
                connectionState = "ponte ausente"
                return
            }
            if (request.status !== 200)
                return

            try {
                var result = JSON.parse(request.responseText)
                var events = result.events || []
                for (var index = 0; index < events.length; index++) {
                    var message = events[index]
                    if (message.protocol === protocol && message.messageType === "CAPTURE_REQUEST")
                        exportCapture(message)
                }
            } catch (error) {
                connectionState = "falhou"
            }
        }

        try {
            request.open("GET", bridgeBaseUrl + "/api/v1/plugin/events", true)
            headers(request)
            request.send()
        } catch (error) {
            requestInFlight = false
            clearSession()
            connectionState = "ponte ausente"
        }
    }

    onRun: {
        openSession()
        pollTimer.start()
    }

    Timer {
        id: pollTimer
        interval: 500
        repeat: true
        running: false
        onTriggered: pollEvents()
    }

    Rectangle {
        anchors.fill: parent
        color: "#f7f2e8"
        border.color: "#263238"
        border.width: 1

        Column {
            anchors.fill: parent
            anchors.margins: 24
            spacing: 14

            Text {
                text: "O Cancioneiro"
                color: "#182226"
                font.bold: true
                font.pixelSize: 22
            }

            Text {
                text: "Captura MusicXML — somente leitura"
                color: "#536064"
                font.pixelSize: 13
            }

            Rectangle {
                width: parent.width
                height: 54
                color: connectionState === "pareado" || connectionState === "enviado" ? "#dcebd9" : "#eee4d3"
                radius: 4

                Column {
                    anchors.fill: parent
                    anchors.margins: 9
                    spacing: 3

                    Text {
                        text: "Estado: " + connectionState
                        color: "#182226"
                        font.bold: true
                    }
                    Text {
                        text: "Partitura atual: " + scoreLabel()
                        color: "#536064"
                        elide: Text.ElideRight
                        width: parent.width
                    }
                }
            }

            Text {
                text: "Ultima tentativa: " + lastScoreLabel
                color: "#536064"
                width: parent.width
                elide: Text.ElideRight
            }

            Text {
                text: "A captura so acontece quando solicitada pelo importador local. Este plugin nao altera a partitura."
                color: "#536064"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Button {
                text: "Reconectar a ponte"
                enabled: !requestInFlight && !exportInProgress
                onClicked: {
                    clearSession()
                    connectionState = "ponte ausente"
                    openSession()
                }
            }
        }
    }
}
