(ns comportexviz.demos.nupic-runner
  (:require [comportexviz.main :as main]
            [comportexviz.bridge.remote :as bridge]
            [comportexviz.util :refer [tap-c]]
            [reagent.core :as reagent :refer [atom]]
            [goog.dom :as dom]
            [cljs.core.async :as async :refer [put! <!]])
  (:require-macros [cljs.core.async.macros :refer [go go-loop]]))

(defn world-pane
  [steps selection]
  (when (not-empty @steps)
    (let [step (main/selected-step steps selection)]
      (when (:input-value step)
        (into [:div]
              (for [[sense-id v] (:sensed-values step)]
                [:div {:style {:margin-top 20}}
                 [:p
                  [:span {:style {:font-family "sans-serif"
                                  :font-size "9px"
                                  :font-weight "bold"}} (name sense-id)]
                  [:br]
                  [:strong (str v)]]]))))))

(defn ^:export init
  []
  (let [into-sim-in (async/chan)
        into-sim-mult (async/mult into-sim-in)
        into-sim-eavesdrop (tap-c into-sim-mult)
        into-journal main/into-journal
        pipe-to-remote-target! (bridge/init
                                (str "ws://localhost:24601")
                                main/local-targets)]
    (pipe-to-remote-target! :into-journal into-journal)
    (pipe-to-remote-target! :into-sim (tap-c into-sim-mult))

    (go-loop []
      (when-not (nil? (<! into-sim-eavesdrop))
        ;; Ensure the journal is still connected, resubscribing if needed.
        (put! into-journal [:ping])
        (recur)))

    (reagent/render [main/comportexviz-app nil
                     [world-pane main/steps main/selection] into-sim-in]
                    (dom/getElement "comportexviz-app"))))
